from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PlatformOption:
    id: str
    label: str
    enabled: bool


PLATFORMS = (
    PlatformOption("macos", "Mac", True),
    PlatformOption("linux", "Linux [TO-DO]", False),
    PlatformOption("windows", "Windows [TO-DO]", False),
)

