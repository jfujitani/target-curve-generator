"""Analytical crossover filter attenuation (cascaded biquad Q-stages)."""
import math
from typing import Dict, List, Sequence, Tuple

from .models import FilterSpec, FilterTopology

Q_STAGES: Dict[FilterTopology, Tuple[float, ...]] = {
    FilterTopology.LR12: (0.5,),
    FilterTopology.LR24: (0.7071, 0.7071),
    FilterTopology.LR48: (0.5412, 1.3065, 0.5412, 1.3065),
    FilterTopology.BW12: (0.7071,),
    FilterTopology.BW24: (0.5412, 1.3065),
    FilterTopology.BW36: (0.5177, 0.7071, 1.9320),
    FilterTopology.BW48: (0.5098, 0.6013, 0.8999, 2.5628),
}


def _denominator(x: float, q: float) -> float:
    return (1.0 - x * x) ** 2 + (x / q) ** 2


def lowpass_stage_db(x: float, q: float) -> float:
    return -10.0 * math.log10(_denominator(x, q))


def highpass_stage_db(x: float, q: float) -> float:
    return 40.0 * math.log10(x) - 10.0 * math.log10(_denominator(x, q))


def attenuation_db(spec: FilterSpec, frequencies: Sequence[float], is_highpass: bool) -> List[float]:
    """Attenuation in dB at each frequency. Bypassed filters return 0.0 dB (identity)."""
    if spec.is_bypassed:
        return [0.0] * len(frequencies)
    stage = highpass_stage_db if is_highpass else lowpass_stage_db
    qs = Q_STAGES[spec.topology]
    return [sum(stage(f / spec.cutoff_hz, q) for q in qs) for f in frequencies]
