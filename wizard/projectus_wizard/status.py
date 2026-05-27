from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from . import macos


@dataclass(frozen=True)
class EnvironmentStatus:
    server_running: bool
    server_health: dict[str, Any] | None
    server_error: str | None
    launch_agent_installed: bool
    launch_agent_path: Path
    release_binary: Path
    release_binary_exists: bool
    local_server_version: str | None
    app_installed: bool
    app_path: Path
    app_version: str | None


def inspect_environment(root: Path) -> EnvironmentStatus:
    health, error = _read_health()
    plist = macos.launch_agent_path()
    binary = macos.release_server_binary(root)
    app = macos.installed_app_path()
    return EnvironmentStatus(
        server_running=health is not None,
        server_health=health,
        server_error=error,
        launch_agent_installed=plist.exists(),
        launch_agent_path=plist,
        release_binary=binary,
        release_binary_exists=binary.exists(),
        local_server_version=_read_local_server_version(root),
        app_installed=app.exists(),
        app_path=app,
        app_version=macos.installed_app_version() if app.exists() else None,
    )


def _read_health() -> tuple[dict[str, Any] | None, str | None]:
    url = f"http://127.0.0.1:{macos.LOCAL_PORT}/api/health"
    try:
        with urllib.request.urlopen(url, timeout=0.8) as response:
            body = response.read().decode("utf-8")
            return json.loads(body), None
    except urllib.error.URLError as error:
        return None, str(error.reason)
    except Exception as error:
        return None, str(error)


def _read_local_server_version(root: Path) -> str | None:
    cargo_toml = root / "crates" / "server" / "Cargo.toml"
    if not cargo_toml.exists():
        return None
    try:
        body = cargo_toml.read_text(encoding="utf-8")
    except OSError:
        return None
    match = re.search(r'(?m)^version\s*=\s*"([^"]+)"', body)
    return match.group(1) if match else None
