# System Architecture: Jazzi's Tuning Companion (Feature 1)

## 1. Architectural Style & Subsystem Overview

The application adopts a **Layered, Pipeline Architecture** with strict downward dependencies and decoupled, stateless components. The pipeline executes synchronously from presentation input to file persistence.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PRESENTATION SUBSYSTEM                           │
│                                                                             │
│     [CLI Ingestion (argparse)]          [Interactive Terminal Wizard]       │
│                 │                                     │                     │
│                 └─────────────────┬───────────────────┘                     │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │ 1. Immutable CommandDTO (TargetProfileRequest)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATION SUBSYSTEM                           │
│                                                                             │
│   • Enforces Validation Boundary / Fail-Fast invariants                     │
│   • Coordinates Domain Queries                                              │
│   • Assembles target response vectors via Identity / Null Object pipeline   │
│                                                                             │
│           │ 2. Query Points                 │ 3. Filter Evaluation          │
│           ▼                                 ▼                               │
│   ┌─────────────────────┐           ┌─────────────────────┐                 │
│   │    PRESET DOMAIN    │           │ ACOUSTIC FILTER DOM │                 │
│   │      SUBSYSTEM      │           │      SUBSYSTEM      │                 │
│   └─────────────────────┘           └─────────────────────┘                 │
│           │                                 │                               │
│           └────────────────┬────────────────┘                               │
│                            │ 4. Immutable Response Vectors (FloatVector[31])│
│                            ▼                                                │
└────────────────────────────┼────────────────────────────────────────────────┘
                             │ 5. ExportPayload DTO
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OUTPUT SUBSYSTEM                               │
│                                                                             │
│   • Target format mapping (REW space-delimited text)                        │
│   • Path normalization & atomic file writes                                 │
│   • Diagnostic receipt returned upward                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directional Dependency & Boundary Rules

1. **Strict Downward Dependency**:
   - Presentation depends on Orchestration.
   - Orchestration depends on Domain services (Presets, Acoustic Filter Math) and Output Exporter.
   - Domain services are **purely functional and decoupled**: they have zero dependencies on CLI, OS, file systems, or presentation concerns.
2. **Stateless Services**:
   - Neither the Orchestrator nor the Domain services retain state across invocations. All operations are pure transformations of inputs to outputs.
3. **Decoupled Data Envelopes**:
   - Layers exchange immutable Data Transfer Objects (DTOs) and numeric sequences (`Sequence[float]`).

---

## 3. Core Architectural Invariants

### 3.1 The Fail-Fast Validation Boundary
- Integrity validation occurs strictly at the entry gate between the **Presentation Layer** and the **Domain Engine**.
- The Domain Engine and Output Subsystem operate under the guarantee of valid state:
  - If a parameter envelope contains invalid bounds (e.g. $f_{HP} \ge f_{LP}$ for a bandpass driver, or an unrecognized curve preset), processing halts at the Orchestration boundary before any computation or file system operations begin.

### 3.2 Null Object / Identity Transformation Rule
- Filter stages that are unconfigured, disabled, or set to bypass ($f_c \le 0$) are modeled using the **Identity Transformation**:
  $$\text{FilterStage.BYPASS} \implies H(f) = 1.0 \quad (\Delta\text{dB} = 0.0)$$
- **Architectural Impact**: Eliminates branching in the domain synthesizer. The synthesizer evaluates every channel through a uniform linear reduction:
  $$\text{TargetVector} = \mathbf{HC} + \mathbf{Atten}_{HP} + \mathbf{Atten}_{LP} + \text{Offset}$$
  where bypassed stages naturally evaluate to the neutral additive element ($0.0\text{ dB}$).

### 3.3 Frequency Grid Synchronization
- All computations and presets align to an immutable, synchronized frequency vector $\mathbf{F} \in \mathbb{R}^{31}$, representing the ISO 1/3-octave center frequencies from 20 Hz to 20,000 Hz.

### 3.4 Atomic Persistence
- The Output subsystem only initiates disk writes once the entire target profile set for all active channels is computed and verified in memory.
- If any stage fails during synthesis, no partial files are left on disk.
