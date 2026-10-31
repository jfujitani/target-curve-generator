# Detailed Design: Jazzi's Tuning Companion (Feature 1)

## 1. Module Structure & Packaging

The project is structured into clear, decoupled Python packages under standard library constraints:

```
jazzi_tuning/
├── __init__.py             # Public API exports
├── core/
│   ├── constants.py        # 31-band ISO frequencies & preset house curves database
│   ├── models.py           # DTOs, Enums, ChannelConfig, TargetProfileRequest, TargetCurveResult
│   ├── filter_engine.py    # Analytical transfer functions & cascaded Q-matrix
│   └── synthesizer.py      # Orchestrator & target response vector synthesis
├── storage/
│   └── rew_exporter.py     # REW space-delimited text serialization & atomic file operations
└── cli/
    ├── parser.py           # Argparse CLI flags for batch execution
    └── wizard.py           # Guided interactive terminal walkthrough
jazzi_rew.py                # Top-level executable entry point (invokes cli)
tests/
    └── test_core.py        # Comprehensive test suite (presets, math, export)
```

---

## 2. Core Data Models (`core/models.py`)

```python
from enum import Enum
from typing import Sequence
from dataclasses import dataclass, field

class FilterTopology(str, Enum):
    BYPASS = "BYPASS"
    LR12 = "LR12"  # Linkwitz-Riley 12 dB/oct (2nd order)
    LR24 = "LR24"  # Linkwitz-Riley 24 dB/oct (4th order)
    LR48 = "LR48"  # Linkwitz-Riley 48 dB/oct (8th order)
    BW12 = "BW12"  # Butterworth 12 dB/oct (2nd order)
    BW24 = "BW24"  # Butterworth 24 dB/oct (4th order)
    BW36 = "BW36"  # Butterworth 36 dB/oct (6th order)
    BW48 = "BW48"  # Butterworth 48 dB/oct (8th order)

@dataclass(frozen=True)
class FilterSpec:
    cutoff_hz: float = 0.0
    topology: FilterTopology = FilterTopology.BYPASS

    @property
    def is_bypassed(self) -> bool:
        return self.topology == FilterTopology.BYPASS or self.cutoff_hz <= 0.0

@dataclass(frozen=True)
class ChannelConfig:
    name: str                 # "Sub2", "Sub1", "Midbass", "Midrange", "Tweeter"
    file_tag: str             # "Sub2", "Sub1", "MB", "Mid", "Tw"
    high_pass: FilterSpec = field(default_factory=FilterSpec)
    low_pass: FilterSpec = field(default_factory=FilterSpec)
    is_active: bool = True

@dataclass(frozen=True)
class TargetProfileRequest:
    curve_name: str
    global_offset_db: float = 0.0
    channels: Sequence[ChannelConfig] = field(default_factory=tuple)
    output_directory: str = "./rew_targets"

@dataclass(frozen=True)
class TargetCurveResult:
    channel_name: str
    file_tag: str
    frequencies: Sequence[float]
    db_values: Sequence[float]
    suggested_filename: str
```

---

## 3. Mathematical Engine Design (`core/filter_engine.py`)

### 3.1 Cascaded Biquad Q-Stages
Each topology is evaluated as a cascade of 2nd-order stages ($Q_k$):
- **LR12**: $(0.5)$
- **LR24**: $(0.7071, 0.7071)$
- **LR48**: $(0.5412, 1.3065, 0.5412, 1.3065)$
- **BW12**: $(0.7071)$
- **BW24**: $(0.5412, 1.3065)$
- **BW36**: $(0.5177, 0.7071, 1.9320)$
- **BW48**: $(0.5098, 0.6013, 0.8999, 2.5628)$

### 3.2 Stage Formulas
For normalized frequency ratio $x = f / f_c$:
$$\text{Denominator Power Factor: } D(x, Q_k) = (1 - x^2)^2 + \left(\frac{x}{Q_k}\right)^2$$
- **Low-Pass Attenuation (dB)**:
  $$\text{LP}_{\text{stage}}(x, Q_k) = -10 \cdot \log_{10}(D(x, Q_k))$$
- **High-Pass Attenuation (dB)**:
  $$\text{HP}_{\text{stage}}(x, Q_k) = 40 \cdot \log_{10}(x) - 10 \cdot \log_{10}(D(x, Q_k))$$

**Bypass Invariant**: If `spec.is_bypassed`, returns $0.0\text{ dB}$ for all points.

---

## 4. Orchestration & Synthesis (`core/synthesizer.py`)

1. **Validation**:
   - Confirms `curve_name` matches known preset database.
   - For every active channel with both HP and LP active, enforces $f_{HP} < f_{LP}$.
2. **Synthesis**:
   - Overall target:
     $$\mathbf{Target}_{\text{overall}} = \mathbf{HC} + \text{offset}$$
   - For each active channel:
     $$\mathbf{Target}_c = \mathbf{HC} + \mathbf{A}_{HP} + \mathbf{A}_{LP} + \text{offset}$$
   - Clamping: Values where $|Target| < 0.1\text{ dB}$ are clamped to $0.0\text{ dB}$.
3. **Filename Generation**:
   - Both HP & LP active: `<Curve>_<Tag>_HP<hp>_LP<lp>_REW.txt`
   - Only LP active: `<Curve>_<Tag>_LP<lp>_REW.txt`
   - Only HP active: `<Curve>_<Tag>_HP<hp>_REW.txt`
   - Overall curve: `<Curve>_Overall_REW.txt`

---

## 5. Storage & REW Format Serialization (`storage/rew_exporter.py`)

- **Format**: Standard 2-column space-delimited text (`Frequency <space> dB`), one entry per line, rounded to 1 decimal place.
- **Atomic Operations**: Verifies target directory, creates temporary write buffer, and cleanly flushes to destination.

---

## 6. Presentation / CLI (`cli/`)

- **Interactive Wizard (`wizard.py`)**:
  - Step 1: House Curve Selection (numbered menu, default: `JBL`).
  - Step 2: Global Offset (default: `0.0 dB`).
  - Step 3: Layout Selection (`3-way + Front & Rear Subs` default).
  - Step 4: Crossover Frequencies with sensible defaults:
    - `Sub2 (Rear)`: 20 Hz HP, 60 Hz LP
    - `Sub1 (Front)`: 25 Hz HP, 80 Hz LP
    - `Midbass`: 80 Hz HP, 350 Hz LP
    - `Midrange`: 350 Hz HP, 3500 Hz LP
    - `Tweeter`: 3500 Hz HP, Bypassed LP
  - Step 5: Slope Selection (default: `LR24`).
  - Step 6: Output Directory (default: `./rew_targets`).
- **Batch / Script Mode (`parser.py`)**:
  - Headless execution via CLI flags:
    `--curve`, `--offset`, `--sub2-hp`, `--sub2-lp`, `--sub1-hp`, `--sub1-lp`, `--mb-hp`, `--mb-lp`, `--mid-hp`, `--mid-lp`, `--tw-hp`, `--tw-lp`, `--slope`, `--out-dir`, `--list-curves`, `--list-filters`.
