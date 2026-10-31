"""DTOs, enums and value objects (see docs/detailed_design.md section 2)."""
from dataclasses import dataclass, field
from enum import Enum
from typing import Mapping, Sequence


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
    name: str  # "Sub2", "Sub1", "Midbass", "Midrange", "Tweeter"
    file_tag: str  # "Sub2", "Sub1", "MB", "Mid", "Tw"
    high_pass: FilterSpec = field(default_factory=FilterSpec)
    low_pass: FilterSpec = field(default_factory=FilterSpec)
    is_active: bool = True


@dataclass(frozen=True)
class TargetProfileRequest:
    curve_name: str
    global_offset_db: float = 0.0
    channels: Sequence[ChannelConfig] = field(default_factory=tuple)
    output_directory: str = "./rew_targets"
    # Optional user-defined curves (name -> 31 dB values), checked before presets.
    custom_curves: Mapping[str, Sequence[float]] = field(default_factory=dict)


@dataclass(frozen=True)
class TargetCurveResult:
    channel_name: str
    file_tag: str
    frequencies: Sequence[float]
    db_values: Sequence[float]
    suggested_filename: str
