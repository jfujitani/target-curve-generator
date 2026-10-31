"""Target Curve Generator (tcg): house curves + crossovers -> REW target files & web studio."""
from .core.constants import ISO_FREQUENCIES_31, PRESET_HOUSE_CURVES
from .core.models import (ChannelConfig, FilterSpec, FilterTopology,
                          TargetCurveResult, TargetProfileRequest)
from .core.synthesizer import (ValidationError, compute_acoustic_sum,
                               synthesize)
from .storage.rew_exporter import export_results, format_rew

__version__ = "2.1.0"
__all__ = [
    "ISO_FREQUENCIES_31",
    "PRESET_HOUSE_CURVES",
    "ChannelConfig",
    "FilterSpec",
    "FilterTopology",
    "TargetCurveResult",
    "TargetProfileRequest",
    "ValidationError",
    "synthesize",
    "compute_acoustic_sum",
    "export_results",
    "format_rew",
]
