"""REW space-delimited text serialization with all-or-nothing writes."""
import os
from pathlib import Path
from typing import List, Sequence

from ..core.models import TargetCurveResult


def format_rew(result: TargetCurveResult) -> str:
    lines = []
    for f, db in sorted(zip(result.frequencies, result.db_values)):
        lines.append(f"{f:g} {db + 0.0:.1f}")  # + 0.0 normalizes -0.0
    return "\n".join(lines) + "\n"


def export_results(results: Sequence[TargetCurveResult], output_directory: str) -> List[Path]:
    """Write every result; nothing is left on disk if any write fails."""
    out = Path(output_directory)
    out.mkdir(parents=True, exist_ok=True)
    temps: List[Path] = []
    finals: List[Path] = []
    try:
        for r in results:
            final = out / r.suggested_filename
            tmp = out / (r.suggested_filename + ".tmp")
            tmp.write_text(format_rew(r), encoding="utf-8", newline="\n")
            temps.append(tmp)
            finals.append(final)
        for tmp, final in zip(temps, finals):
            os.replace(tmp, final)
    except Exception:
        for tmp in temps:
            tmp.unlink(missing_ok=True)
        raise
    return finals
