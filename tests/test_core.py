import math
import tempfile
import unittest
from pathlib import Path

from tcg import (ChannelConfig, FilterSpec, FilterTopology, ISO_FREQUENCIES_31,
                          PRESET_HOUSE_CURVES, TargetProfileRequest, ValidationError,
                          export_results, format_rew, synthesize)
from tcg.core.filter_engine import attenuation_db

T = FilterTopology
ORDER = {T.LR12: 2, T.LR24: 4, T.LR48: 8, T.BW12: 2, T.BW24: 4, T.BW36: 6, T.BW48: 8}


def lp(fc, t): return FilterSpec(fc, t)


class PresetTests(unittest.TestCase):
    def test_all_curves_have_31_points(self):
        self.assertEqual(len(ISO_FREQUENCIES_31), 31)
        for name, c in PRESET_HOUSE_CURVES.items():
            self.assertEqual(len(c), 31, name)

    def test_required_presets_present(self):
        for n in ["Whitledge", ".5 Whitledge", "JBL", "Jazzi", "Jazzi v2", "EPY", "ATF", "Flat"]:
            self.assertIn(n, PRESET_HOUSE_CURVES)

    def test_spot_values_match_workbook(self):
        # (curve, frequency, dB) read from 'Target Curves' sheet of Jazzi's Tuning Companion v8.2
        spots = [("Whitledge", 20, 24), ("Whitledge", 20000, -10), ("Whitledge", 1000, -3),
                 (".5 Whitledge", 20, 12), (".5 Whitledge", 20000, -5), ("JBL", 20, 9),
                 ("JBL", 20000, -6), ("Jazzi v2", 20, 17), ("Jazzi", 3100, -3),
                 ("EPY", 63, 9), ("Audiofrog", 63, 6.4), ("ATF", 20, 10), ("ATF", 20000, -5), ("Flat", 500, 0)]
        for name, f, db in spots:
            i = ISO_FREQUENCIES_31.index(f)
            self.assertAlmostEqual(PRESET_HOUSE_CURVES[name][i], db, delta=0.1, msg=f"{name}@{f}")

    def test_half_whitledge_is_half(self):
        for w, h in zip(PRESET_HOUSE_CURVES["Whitledge"], PRESET_HOUSE_CURVES[".5 Whitledge"]):
            self.assertAlmostEqual(h, w / 2, delta=0.1)

    def test_grid_ascending(self):
        self.assertEqual(list(ISO_FREQUENCIES_31), sorted(ISO_FREQUENCIES_31))


class FilterMathTests(unittest.TestCase):
    def at_fc(self, t, hp):
        return attenuation_db(FilterSpec(1000.0, t), [1000.0], hp)[0]

    def test_butterworth_minus_3db(self):
        for t in (T.BW12, T.BW24, T.BW36, T.BW48):
            for hp in (False, True):
                self.assertAlmostEqual(self.at_fc(t, hp), -3.01, delta=0.02, msg=f"{t} hp={hp}")

    def test_linkwitz_riley_minus_6db(self):
        for t in (T.LR12, T.LR24, T.LR48):
            for hp in (False, True):
                self.assertAlmostEqual(self.at_fc(t, hp), -6.02, delta=0.02, msg=f"{t} hp={hp}")

    def test_stopband_slopes(self):
        for t, order in ORDER.items():
            nominal = 6 * order
            lp_spec = FilterSpec(100.0, t)
            a, b = attenuation_db(lp_spec, [3200.0, 6400.0], False)
            self.assertAlmostEqual(a - b, nominal, delta=0.5, msg=f"LP {t}")
            hp_spec = FilterSpec(10000.0, t)
            a, b = attenuation_db(hp_spec, [300.0, 150.0], True)
            self.assertAlmostEqual(a - b, nominal, delta=0.5, msg=f"HP {t}")

    def test_passband_flat(self):
        self.assertAlmostEqual(attenuation_db(lp(10000, T.LR24), [20.0], False)[0], 0.0, delta=0.001)
        self.assertAlmostEqual(attenuation_db(lp(20, T.LR24), [20000.0], True)[0], 0.0, delta=0.001)


class IdentityTests(unittest.TestCase):
    def test_bypass_is_zero(self):
        for spec in (FilterSpec(), FilterSpec(100, T.BYPASS), FilterSpec(0, T.LR24), FilterSpec(-5, T.BW12)):
            self.assertTrue(spec.is_bypassed)
            for hp in (True, False):
                self.assertEqual(attenuation_db(spec, ISO_FREQUENCIES_31, hp), [0.0] * 31)

    def test_bypassed_channel_equals_curve_plus_offset(self):
        req = TargetProfileRequest("JBL", 2.0, (ChannelConfig("X", "X"),))
        res = synthesize(req)
        for r in res:
            for v, h in zip(r.db_values, PRESET_HOUSE_CURVES["JBL"]):
                expect = h + 2.0
                self.assertAlmostEqual(v, 0.0 if abs(expect) < 0.1 else expect, places=9)


class SynthesizerTests(unittest.TestCase):
    def test_unknown_curve_rejected(self):
        with self.assertRaises(ValidationError):
            synthesize(TargetProfileRequest("Nope"))

    def test_hp_ge_lp_rejected(self):
        for hp, lpf in ((100, 100), (200, 100)):
            ch = ChannelConfig("MB", "MB", FilterSpec(hp, T.LR24), FilterSpec(lpf, T.LR24))
            with self.assertRaises(ValidationError):
                synthesize(TargetProfileRequest("JBL", 0, (ch,)))

    def test_inactive_channel_not_validated_or_emitted(self):
        ch = ChannelConfig("MB", "MB", FilterSpec(200, T.LR24), FilterSpec(100, T.LR24), is_active=False)
        res = synthesize(TargetProfileRequest("JBL", 0, (ch,)))
        self.assertEqual([r.channel_name for r in res], ["Overall"])

    def test_filenames(self):
        c = lambda hp, l: ChannelConfig("MB", "MB", FilterSpec(hp, T.LR24), FilterSpec(l, T.LR24))
        names = [synthesize(TargetProfileRequest("Whitledge", 0, (c(80, 350),)))[1].suggested_filename,
                 synthesize(TargetProfileRequest("Whitledge", 0, (c(0, 350),)))[1].suggested_filename,
                 synthesize(TargetProfileRequest("Whitledge", 0, (c(80, 0),)))[1].suggested_filename,
                 synthesize(TargetProfileRequest("Whitledge", 0, ()))[0].suggested_filename,
                 synthesize(TargetProfileRequest(".5 Whitledge", 0, ()))[0].suggested_filename]
        self.assertEqual(names, ["Whitledge_MB_HP80_LP350_REW.txt", "Whitledge_MB_LP350_REW.txt",
                                 "Whitledge_MB_HP80_REW.txt", "Whitledge_Overall_REW.txt",
                                 "0.5_Whitledge_Overall_REW.txt"])

    def test_clamp_small_values(self):
        req = TargetProfileRequest("Flat", 0.05, ())
        self.assertEqual(set(synthesize(req)[0].db_values), {0.0})

    def test_custom_curve(self):
        req = TargetProfileRequest("Mine", 1.0, (), custom_curves={"Mine": [3.0] * 31})
        self.assertEqual(set(synthesize(req)[0].db_values), {4.0})
        with self.assertRaises(ValidationError):
            synthesize(TargetProfileRequest("Mine", 0, (), custom_curves={"Mine": [1.0] * 5}))

    def test_bandpass_shape(self):
        ch = ChannelConfig("MB", "MB", FilterSpec(80, T.LR24), FilterSpec(350, T.LR24))
        r = synthesize(TargetProfileRequest("Flat", 0, (ch,)))[1]
        d = dict(zip(r.frequencies, r.db_values))
        self.assertAlmostEqual(d[80], -6.0, delta=0.1)
        self.assertLess(d[20], -40)
        self.assertLess(d[5000], -40)


class ExporterTests(unittest.TestCase):
    def test_format(self):
        r = synthesize(TargetProfileRequest("JBL", 0, ()))[0]
        lines = format_rew(r).splitlines()
        self.assertEqual(len(lines), 31)
        freqs = []
        for ln in lines:
            parts = ln.split(" ")
            self.assertEqual(len(parts), 2)
            freqs.append(float(parts[0]))
            self.assertRegex(parts[1], r"^-?\d+\.\d$")
        self.assertEqual(freqs, sorted(freqs))
        self.assertEqual(lines[0], "20 9.0")

    def test_no_negative_zero(self):
        r = synthesize(TargetProfileRequest("Flat", 0, ()))[0]
        self.assertNotIn("-0.0", format_rew(r))

    def test_export_writes_files(self):
        with tempfile.TemporaryDirectory() as d:
            ch = ChannelConfig("Tw", "Tw", FilterSpec(3500, T.LR24))
            res = synthesize(TargetProfileRequest("JBL", 0, (ch,), d))
            paths = export_results(res, str(Path(d) / "sub"))
            self.assertEqual(sorted(p.name for p in paths), ["JBL_Overall_REW.txt", "JBL_Tw_HP3500_REW.txt"])
            self.assertEqual(list((Path(d) / "sub").glob("*.tmp")), [])

    def test_failed_export_leaves_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            res = synthesize(TargetProfileRequest("JBL", 0, (ChannelConfig("A", "A"),)))
            bad = res[0].__class__("B", "B", res[0].frequencies, res[0].db_values, "sub/does_not_exist.txt")
            with self.assertRaises(OSError):
                export_results([res[0], bad], d)
            self.assertEqual(list(Path(d).glob("*")), [])


if __name__ == "__main__":
    unittest.main()
