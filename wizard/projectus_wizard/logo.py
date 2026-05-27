from __future__ import annotations

from pathlib import Path

from rich.text import Text

from .theme import ACCENT, ACCENT_END


def load_logo(root: Path) -> Text:
    path = root / "wizard" / "logo.txt"
    raw = path.read_text(encoding="utf-8").splitlines()
    logo = Text()
    total = max(len(raw) - 1, 1)
    for index, line in enumerate(raw):
        color = _blend(ACCENT, ACCENT_END, index / total)
        logo.append(line, style=f"bold {color}")
        if index != len(raw) - 1:
            logo.append("\n")
    return logo


def _blend(start: str, end: str, ratio: float) -> str:
    left = _hex_to_rgb(start)
    right = _hex_to_rgb(end)
    mixed = tuple(round(a + (b - a) * ratio) for a, b in zip(left, right))
    return "#{:02X}{:02X}{:02X}".format(*mixed)


def _hex_to_rgb(value: str) -> tuple[int, int, int]:
    clean = value.removeprefix("#")
    return int(clean[0:2], 16), int(clean[2:4], 16), int(clean[4:6], 16)

