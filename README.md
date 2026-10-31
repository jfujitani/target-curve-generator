# Target Curve Generator (`tcg`)

An interactive car audio acoustic target designer and Room EQ Wizard (REW) curve exporter.

Designed as a modern, cross-platform replacement for legacy Excel/VBA tuning companion workbooks (such as Jazzi's Tuning Companion and JEB Tuning Companion), `tcg` allows car audio enthusiasts and DSP sound engineers to select or import house curves, configure active multi-way acoustic crossovers, visualize acoustic summation in real time, and export clean target files ready for REW.

---

## Documentation

For comprehensive engineering specifications, architecture diagrams, and domain reference guides, see the [`docs/`](docs/) directory:

- [**Target Curve Generator Specification & Usage Guide**](docs/target_curve_generator_spec.md): Tool capabilities, house curve presets overview, and step-by-step Room EQ Wizard (REW) import workflow.
- [**System Architecture**](docs/architecture.md): Layered architecture, client-side DSP pipeline, invariants, and zero-dependency offline design.
- [**Detailed Technical Design**](docs/detailed_design.md): Cascaded biquad $Q$-stage matrices, mathematical attenuation formulas, coherent acoustic gain summation equations, and module structures.

---

## Features

- **Interactive Logarithmic Audio Visualizer**: Classical 20 Hz – 20,000 Hz scale with major decade gridlines (20, 100, 1k, 10k, 20k) and standard audio subgrid divisions.
- **Real-Time Crossover Modeling**: 60 fps responsive updates when dragging frequency sliders or entering direct Hz values.
- **Coherent Acoustic Summation**: Live trace showing the combined acoustic response across all active channels.
- **Built-In Preset Library**:
  - `JBL` / `Audiofrog` (Andy Wehmeyer)
  - `Whitledge` & `.5 Whitledge`
  - `Jazzi` & `Jazzi v2`
  - `ATF` (Audiotec Fischer / Helix)
  - `Harman`, `EPY`, `Nick`, `Flat`
- **Custom Curve Management**:
  - Drag-and-drop import for REW `.txt` and `.csv` files with automatic 31-band ISO interpolation.
  - Interactive 31-band manual point editor for fine-tuning target dB values.
  - Browser `localStorage` persistence across visits with JSON backup & restore.
- **Multi-Channel Active Deck**:
  - Default layout: `Rear Sub (Sub2)`, `Front Sub (Sub1)`, `Midbass`, `Midrange`, `Tweeter`.
  - Independent High-Pass (HP) and Low-Pass (LP) controls with bypass toggles.
  - Filter topologies: Linkwitz-Riley (`LR12`, `LR24`, `LR48`) and Butterworth (`BW12`, `BW24`, `BW36`, `BW48`).
- **Flexible REW Export**:
  - Single-click download for individual driver target `.txt` files.
  - All-in-one **Export All (.zip)** archive containing all driver curves and `Overall_REW.txt`.
- **Zero-Dependency & Offline-Ready**: Works 100% in the browser without any npm build steps or internet connection (Chart.js and JSZip are bundled locally).

---

## Quick Start

### Option 1: Run via Python (Recommended for Local Use)
Launch the built-in local server and automatically open the studio in your default browser:

```bash
python3 tcg.py
```

To specify a custom port:
```bash
python3 tcg.py --port 9000
```

### Option 2: Pure Static Web (No Server Required)
Open `web/index.html` directly in any modern browser (Chrome, Firefox, Safari, Edge). You can also host the `web/` folder on GitHub Pages, Netlify, or any static file host.

---

## Workflow with Room EQ Wizard (REW)

1. **Design Target in `tcg`**:
   - Select your base house curve (or import a custom curve).
   - Configure driver crossover points and slopes to match your acoustic targets.
   - Adjust the **Global Offset (dB)** to align with your measurement level.
   - Click **Export All (.zip)** to download your REW target curves.
2. **Import into REW**:
   - In REW's **EQ Window**, navigate to **Target Settings**.
   - Under **House Curve**, load the corresponding exported driver curve file (e.g. `JBL_MB_HP80_LP350_REW.txt`).
   - REW will optimize parametric EQ filters to match your measured response to the acoustic target curve.

---

## Repository Structure

```
├── web/                       # Standalone Web Application
│   ├── index.html             # Studio UI
│   ├── css/style.css          # Styling & dark theme
│   ├── js/
│   │   ├── app.js             # Application coordinator
│   │   ├── chart_view.js      # Logarithmic audio chart (Chart.js)
│   │   ├── curve_storage.js   # LocalStorage & REW/CSV parser
│   │   ├── dsp_engine.js      # Biquad filter transfer functions & acoustic summation
│   │   ├── exporter.js        # REW text & zip bundler
│   │   └── presets_data.js    # Built-in presets database
│   └── vendor/                # Bundled offline libraries (chart.min.js, jszip.min.js)
├── tcg/                       # Python Core Domain Library
│   ├── core/                  # Analytical transfer functions, models & presets
│   └── storage/               # Atomic REW text file serialization
├── tests/                     # Unit test suite verifying acoustic math & presets
├── docs/                      # Architectural and technical documentation
│   ├── architecture.md        # System architecture and data flow
│   ├── detailed_design.md     # Mathematical formulas & component designs
│   └── target_curve_generator_spec.md # Domain specification & REW workflow
└── tcg.py                     # Convenience local launcher script
```

---

## Running Automated Tests

To verify that the underlying filter math, Linkwitz-Riley/Butterworth attenuation formulas, and preset databases match theoretical acoustics:

```bash
python3 -m unittest discover -s tests -t .
```

All 22 unit tests run in milliseconds using only Python's standard library.

---

## Acknowledgments & Heritage

`tcg` is an open-source modernization of the Excel/VBA audio tuning workbooks originally created and maintained by the car audio community:
- **Justin Zazzi** (*Jazzi* / *Wave Shepherd*) — Created the original *Jazzi's Tuning Companion for REW* spreadsheet, establishing the methodology of combining empirical house curves with active acoustic crossover modeling.
- **Erica (@AudioGal) & @Uberverbosity** — Maintained and expanded community iterations (*JEB Tuning Companion*), contributing unified 5-channel system layouts and multi-platform target workflows.

---

## License

Open source under the MIT License.
