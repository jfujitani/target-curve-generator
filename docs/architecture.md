# System Architecture: Target Curve Generator (tcg)

## 1. Architectural Style & Overview

**Target Curve Generator (tcg)** is structured as a **Pure Web Application & Core Acoustic Domain System**:
1. **Interactive Web Application (`web/`)**: Real-time client-side DSP studio running directly in the browser with continuous interactive logarithmic visualization, curve management, local storage persistence, and in-browser REW export (individual files or `.zip` bundle).
2. **Local Static Launcher (`tcg.py`)**: Zero-dependency local runner using Python's standard library `http.server` to serve the web files and open the browser (`python3 tcg.py`).
3. **Core Acoustic Domain Engine (`web/js/dsp_engine.js` & `tcg/core/`)**: Pure analytical transfer functions and preset database implementing cascaded biquad $Q$-stages and coherent acoustic gain summation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PRESENTATION LAYER                               │
│                                                                             │
│     [Target Curve Generator Web Studio (web/)]                              │
│      • Audio Logarithmic Chart (20 Hz - 20 kHz)                             │
│      • Drag & Drop Curve Import (.txt, .csv) & 31-Band Point Editor         │
│      • Continuous Crossover Frequency & Slope Controls                      │
│      • In-Browser REW Text Download & JSZip Bundling                        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       │ Client-Side Execution (Offline)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ACOUSTIC DSP DOMAIN ENGINE                            │
│                                                                             │
│   • Cascaded Biquad Q-Stages (LR12-48, BW12-48)                             │
│   • Coherent Acoustic Summation across Channels                             │
│   • Standard 31-Band ISO Frequency Grid                                     │
│   • 220-Point Logarithmic Interpolation for Smooth Slopes                   │
│   • Browser LocalStorage Persistence for Custom Curves                      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               OUTPUT LAYER                                  │
│                                                                             │
│   • REW Space-Delimited Serialization (<Frequency> <dB>)                    │
│   • Direct In-Browser File Downloads (Blobs)                                │
│   • Bundled .zip Archives (JSZip)                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Invariants

### 2.1 Null Object / Identity Transformation Rule
- Filter stages set to bypass ($f_c \le 0$ or `BYPASS`) evaluate to the neutral additive element ($0.0\text{ dB}$ attenuation across all frequencies).
- Channel target vectors evaluate uniformly as:
  $$\mathbf{Target}_c = \mathbf{HC} + \mathbf{A}_{HP} + \mathbf{A}_{LP} + \text{offset}$$

### 2.2 Coherent Acoustic Summation
- The summed acoustic response across all active channels is evaluated coherently:
  $$Target_{\text{summed}}(f) = HC(f) + \text{offset} + 20 \log_{10}\left( \sum_{c} 10^{A_c(f) / 20} \right)$$
  For standard Linkwitz-Riley crossovers summing at their -6.02 dB cutoff frequencies, adjacent drivers sum perfectly flat to $0.0\text{ dB}$ relative to the house curve.

### 2.3 Frequency Grid Synchronization
- All curve exports use the standard 31-band 1/3-octave center frequencies from 20 Hz to 20,000 Hz.
- The interactive chart evaluates smooth continuous curves using 220 logarithmically spaced calculation points to ensure clean slopes without polygonal step artifacts.

### 2.4 Offline-First & Zero Non-Standard Dependencies
- The application requires no Node/npm builds, no external compilers, and no internet connection.
- Vendor libraries (`Chart.js` and `JSZip`) are bundled locally under `web/vendor/`.
