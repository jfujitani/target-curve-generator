# Target Curve Generator (tcg): Specification & REW Guide

This document describes the capabilities, acoustic crossover design, preset curves, and Room EQ Wizard (REW) import workflow for **Target Curve Generator (`tcg`)**.

---

## 1. Capabilities Overview

### Target Curves & Acoustic Crossover Studio
- **Built-in House Curve Presets**:
  - **Whitledge**: Pronounced low-end bass rise (+24 dB at 20 Hz tapering through midbass) with a gentle high-frequency roll-off (-10 dB at 20 kHz) to counter road noise masking and cabin reflections.
  - **Half-Whitledge (`.5 Whitledge`)**: Exactly half the amplitude of the Whitledge curve (+12 dB at 20 Hz to -5 dB at 20 kHz) for a milder tonal balance.
  - **JBL / Audiofrog**: Controlled ~9 dB bass shelf and smooth ~0.5–1 dB/octave downward tilt above 1 kHz.
  - **Jazzi / Jazzi v2**: Punchy sub/midbass shelf with a smooth treble taper.
  - **EPY**: Strong sub-bass shelf and tailored midrange transition.
  - **ATF**: Reference target profile for Audiotec Fischer (Helix/Brax/Match) systems.
  - **Harman & Nick**: Automotive target contours with tailored bass rise and treble rolloff.
  - **Flat**: 0 dB reference line across all frequencies.
- **Custom Curve Management**:
  - Drag-and-drop import for REW `.txt` and `.csv` curve files with automatic 31-band logarithmic interpolation.
  - Manual 31-band point editor to tweak individual frequency target dB values.
  - Browser `localStorage` persistence across visits with JSON backup & restore.
- **Acoustic Crossover Integration**:
  - Multi-driver system deck: `Sub2` (rear/trunk sub), `Sub1` (front sub), `Midbass`, `Midrange`, `Tweeter` (+ individual active toggles).
  - High-Pass (HP) and Low-Pass (LP) frequency controls with sliders, direct Hz numeric input, and instant bypass toggle buttons.
  - Supported filter topologies:
    - **Linkwitz-Riley (LR)**: `12 dB/oct` (LR12), `24 dB/oct` (LR24 — industry favorite summing flat at -6 dB), and `48 dB/oct` (LR48).
    - **Butterworth (BW)**: `12 dB/oct` (BW12), `24 dB/oct` (BW24), `36 dB/oct` (BW36), and `48 dB/oct` (BW48).
- **Acoustic Summation**:
  - Live coherent acoustic summation trace showing the combined acoustic energy of all active channels.
- **REW Export**:
  - Standard 2-column format (`Frequency <space> dB`) compatible with both REW House Curve target settings and REW Measurement Overlays.
  - Download individual driver curves or export all active curves as a single `.zip` bundle.

---

## 2. Workflow Guide: Using with Room EQ Wizard (REW)

1. **Design Target in `tcg`**:
   - Run `python3 tcg.py`.
   - Select your target curve and configure your driver crossover frequencies.
   - Click **Export All (.zip)** to save the set of REW `.txt` files.
2. **Import into REW**:
   - In REW's **EQ Window**, go to **Target Settings**.
   - Choose **Target Type: None** or **Subwoofer / Speaker**.
   - Under **House Curve**, load the corresponding exported driver file (e.g. `JBL_MB_HP80_LP350_REW.txt`).
   - REW's EQ optimization filter generator will calculate biquad parametric EQ filters to shape the raw acoustic measurement to the target curve.
