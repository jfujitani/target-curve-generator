"""Orchestrator: validates a request and synthesizes target curves."""
import math
from typing import List, Sequence

from .constants import ISO_FREQUENCIES_31, PRESET_HOUSE_CURVES
from .filter_engine import attenuation_db
from .models import ChannelConfig, TargetCurveResult, TargetProfileRequest

CLAMP_THRESHOLD_DB = 0.1


class ValidationError(ValueError):
    """Raised at the fail-fast boundary for invalid requests."""


def _fmt(v: float) -> str:
    return f"{v:g}"


def _curve_label(name: str) -> str:
    label = name.strip().replace(" ", "_")
    if label.startswith("."):
        label = "0" + label
    return label


def _resolve_curve(request: TargetProfileRequest):
    if request.curve_name in request.custom_curves:
        curve = tuple(request.custom_curves[request.curve_name])
    elif request.curve_name in PRESET_HOUSE_CURVES:
        curve = PRESET_HOUSE_CURVES[request.curve_name]
    else:
        raise ValidationError(
            f"Unknown curve '{request.curve_name}'. Available: {', '.join(PRESET_HOUSE_CURVES)}"
        )
    if len(curve) != len(ISO_FREQUENCIES_31):
        raise ValidationError(f"Curve '{request.curve_name}' must have {len(ISO_FREQUENCIES_31)} values")
    return curve


def validate(request: TargetProfileRequest) -> None:
    _resolve_curve(request)
    for ch in request.channels:
        if not ch.is_active:
            continue
        hp, lp = ch.high_pass, ch.low_pass
        if not hp.is_bypassed and not lp.is_bypassed and hp.cutoff_hz >= lp.cutoff_hz:
            raise ValidationError(
                f"Channel {ch.name}: high-pass ({hp.cutoff_hz:g} Hz) must be below low-pass ({lp.cutoff_hz:g} Hz)"
            )


def _filename(label: str, ch: ChannelConfig) -> str:
    parts = [label, ch.file_tag]
    if not ch.high_pass.is_bypassed:
        parts.append("HP" + _fmt(ch.high_pass.cutoff_hz))
    if not ch.low_pass.is_bypassed:
        parts.append("LP" + _fmt(ch.low_pass.cutoff_hz))
    return "_".join(parts) + "_REW.txt"


def _clean(values: Sequence[float]) -> List[float]:
    return [0.0 if abs(v) < CLAMP_THRESHOLD_DB else v for v in values]


def compute_acoustic_sum(
    house_curve: Sequence[float],
    channel_attenuations: Sequence[Sequence[float]],
    offset_db: float = 0.0,
) -> List[float]:
    """Compute the combined acoustic response across all active channels.

    At each frequency, the channel acoustic gains (linear voltage/amplitude ratio)
    are summed coherently: Gain_total = sum( 10^(A_c / 20) ).
    Total dB = HouseCurve + Offset + 20 * log10(Gain_total).
    """
    num_points = len(house_curve)
    if not channel_attenuations:
        return _clean([h + offset_db for h in house_curve])

    summed_db: List[float] = []
    for i in range(num_points):
        total_amp = sum(10.0 ** (ch_atten[i] / 20.0) for ch_atten in channel_attenuations)
        if total_amp <= 1e-12:
            db_val = -120.0
        else:
            db_val = 20.0 * math.log10(total_amp)
        summed_db.append(house_curve[i] + offset_db + db_val)

    return _clean(summed_db)


def synthesize(request: TargetProfileRequest, include_summed: bool = False) -> List[TargetCurveResult]:
    """Return the overall curve, one result per active channel, and optionally the summed acoustic response."""
    validate(request)
    freqs = tuple(ISO_FREQUENCIES_31)
    hc = _resolve_curve(request)
    off = request.global_offset_db
    label = _curve_label(request.curve_name)

    results = [
        TargetCurveResult(
            "Overall",
            "Overall",
            freqs,
            tuple(_clean([h + off for h in hc])),
            f"{label}_Overall_REW.txt",
        )
    ]

    channel_attenuations: List[List[float]] = []
    for ch in request.channels:
        if not ch.is_active:
            continue
        a_hp = attenuation_db(ch.high_pass, freqs, True)
        a_lp = attenuation_db(ch.low_pass, freqs, False)
        ch_atten = [p + l for p, l in zip(a_hp, a_lp)]
        channel_attenuations.append(ch_atten)

        vals = _clean([h + att + off for h, att in zip(hc, ch_atten)])
        results.append(
            TargetCurveResult(ch.name, ch.file_tag, freqs, tuple(vals), _filename(label, ch))
        )

    if include_summed and channel_attenuations:
        summed_vals = compute_acoustic_sum(hc, channel_attenuations, off)
        results.append(
            TargetCurveResult(
                "Summed",
                "Summed",
                freqs,
                tuple(summed_vals),
                f"{label}_Summed_REW.txt",
            )
        )

    return results
