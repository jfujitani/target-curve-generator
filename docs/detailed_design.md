# Detailed Design: Target Curve Generator (tcg)

## 1. Module Structure & Packaging

The codebase is organized into an offline-capable, zero-dependency interactive Web Application and a supporting Python core library:

```
├── docs/                             # Architectural and technical documentation
│   ├── architecture.md
│   ├── detailed_design.md
│   └── target_curve_generator_spec.md
├── tcg.py                            # Local launcher: starts server and opens browser
├── web/                              # Interactive Single-Page Web Application
│   ├── index.html                    # Dark-themed car audio DSP studio interface
│   ├── css/
│   │   └── style.css                 # Styling & responsive layout
│   ├── js/
│   │   ├── app.js                    # Application controller & state coordination
│   │   ├── chart_view.js             # Classical 20 Hz - 20 kHz audio log chart (Chart.js)
│   │   ├── curve_storage.js          # LocalStorage persistence & REW/CSV file parser
│   │   ├── dsp_engine.js             # Analytical biquad DSP engine & acoustic summation
│   │   ├── exporter.js               # REW text & JSZip bundle exporter
│   │   └── presets_data.js           # Built-in house curves database
│   └── vendor/
│       ├── chart.min.js              # Offline bundled Chart.js
│       └── jszip.min.js              # Offline bundled JSZip
├── tcg/                              # Python Core Library
│   ├── __init__.py                   # Public package exports
│   ├── core/
│   │   ├── constants.py              # 31-band ISO frequencies & preset house curves database
│   │   ├── filter_engine.py          # Cascaded biquad transfer functions
│   │   ├── models.py                 # Data models, DTOs & Enums
│   │   └── synthesizer.py            # Target curve synthesis & acoustic summation
│   └── storage/
│       └── rew_exporter.py           # Atomic REW space-delimited text exporter
└── tests/
    ├── __init__.py
    └── test_core.py                  # Unit tests (filter math, presets, validation, export)
```

---

## 2. Mathematical DSP Engine Design

Both `web/js/dsp_engine.js` (JavaScript) and `tcg/core/filter_engine.py` (Python) implement identical analytical cascaded biquad $Q$-stage calculations.

### 2.1 Cascaded Biquad Q-Stages
Each topology is evaluated as a cascade of 2nd-order stages ($Q_k$):
- **LR12**: $(0.5)$
- **LR24**: $(0.7071, 0.7071)$
- **LR48**: $(0.5412, 1.3065, 0.5412, 1.3065)$
- **BW12**: $(0.7071)$
- **BW24**: $(0.5412, 1.3065)$
- **BW36**: $(0.5177, 0.7071, 1.9320)$
- **BW48**: $(0.5098, 0.6013, 0.8999, 2.5628)$

### 2.2 Stage Formulas
For normalized frequency ratio $x = f / f_c$:
$$\text{Denominator Power Factor: } D(x, Q_k) = (1 - x^2)^2 + \left(\frac{x}{Q_k}\right)^2$$
- **Low-Pass Attenuation (dB)**:
  $$\text{LP}_{\text{stage}}(x, Q_k) = -10 \cdot \log_{10}(D(x, Q_k))$$
- **High-Pass Attenuation (dB)**:
  $$\text{HP}_{\text{stage}}(x, Q_k) = 40 \cdot \log_{10}(x) - 10 \cdot \log_{10}(D(x, Q_k))$$

### 2.3 Coherent Acoustic Summation Formula
$$\text{Gain}_{\text{total}}(f) = \sum_{c} 10^{\frac{A_c(f)}{20}}$$
$$\text{Target}_{\text{summed}}(f) = \text{HC}(f) + \text{offset} + 20 \cdot \log_{10}(\text{Gain}_{\text{total}}(f))$$

---

## 3. Web Application Components (`web/`)

- **State Management (`app.js`)**: Coordinates active speaker drivers (`Sub2`, `Sub1`, `Midbass`, `Midrange`, `Tweeter`), selected house curve, global offset, and real-time graph updates.
- **Continuous Logarithmic Audio Scale (`chart_view.js`)**:
  - Logarithmic X-axis from 20 Hz to 20,000 Hz.
  - Prominent major decade lines at 20 Hz, 100 Hz, 1 kHz, 10 kHz, and 20 kHz.
  - Intermediate sub-octave grid lines (30, 40, 50, 60, 70, 80, 200, 300, 400, etc.).
- **Curve Storage & Import (`curve_storage.js`)**:
  - Stores custom user curves in browser `localStorage`.
  - Parses REW text files and CSV format with automatic log-frequency interpolation to 31 bands.
  - JSON backup and restore for curve libraries.
- **Export System (`exporter.js`)**:
  - REW space-delimited text generation (`Frequency <space> dB`).
  - Single-driver `.txt` downloads via Blobs.
  - Full-system `.zip` bundle export using bundled JSZip.

---

## 4. Running the Application

Launch the local web server and open the application in your browser:
```bash
python3 tcg.py
```
*(Optional port: `python3 tcg.py --port 8080`)*

The application runs completely offline with no external internet connection or npm build steps required. Python's standard library `http.server` handles local serving to satisfy browser ES module security policies.
