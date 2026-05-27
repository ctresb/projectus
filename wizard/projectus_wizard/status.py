from __future__ import annotations

import json
import os
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
    server_discovery: dict[str, Any] | None
    server_error: str | None
    server_app_launch_agent_installed: bool
    server_app_launch_agent_path: Path
    headless_launch_agent_installed: bool
    headless_launch_agent_path: Path
    release_binary: Path
    release_binary_exists: bool
    local_server_version: str | None
    desktop_app_installed: bool
    desktop_app_path: Path
    desktop_app_version: str | None
    server_app_installed: bool
    server_app_path: Path
    server_app_version: str | None


def inspect_environment(root: Path) -> EnvironmentStatus:
    health, health_error = _read_health()
    discovery, discovery_error = _read_discovery()
    server_app_plist = macos.server_app_launch_agent_path()
    headless_plist = macos.headless_launch_agent_path()
    binary = macos.release_server_binary(root)
    desktop_app = macos.installed_desktop_app_path()
    server_app = macos.installed_server_app_path()
    return EnvironmentStatus(
        server_running=health is not None or discovery is not None,
        server_health=health,
        server_discovery=discovery,
        server_error=health_error or discovery_error,
        server_app_launch_agent_installed=server_app_plist.exists(),
        server_app_launch_agent_path=server_app_plist,
        headless_launch_agent_installed=headless_plist.exists(),
        headless_launch_agent_path=headless_plist,
        release_binary=binary,
        release_binary_exists=binary.exists(),
        local_server_version=_read_local_server_version(root),
        desktop_app_installed=desktop_app.exists(),
        desktop_app_path=desktop_app,
        desktop_app_version=macos.installed_app_version(desktop_app) if desktop_app.exists() else None,
        server_app_installed=server_app.exists(),
        server_app_path=server_app,
        server_app_version=macos.installed_app_version(server_app) if server_app.exists() else None,
    )


def _read_health() -> tuple[dict[str, Any] | None, str | None]:
    url = f"http://127.0.0.1:{macos.LOCAL_PORT}/api/health"
    token = os.environ.get("PROJECTUS_SERVER_TOKEN")
    request = urllib.request.Request(url)
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=0.8) as response:
            body = response.read().decode("utf-8")
            return json.loads(body), None
    except urllib.error.HTTPError as error:
        if error.code == 401:
            return None, "servidor respondeu, mas /api/health exige PROJECTUS_SERVER_TOKEN"
        return None, str(error)
    except urllib.error.URLError as error:
        return None, str(error.reason)
    except Exception as error:
        return None, str(error)


def _read_discovery() -> tuple[dict[str, Any] | None, str | None]:
    url = f"http://127.0.0.1:{macos.LOCAL_PORT}/api/discovery"
    try:
        with urllib.request.urlopen(url, timeout=0.8) as response:
            body = response.read().decode("utf-8")
            return json.loads(body), None
    except urllib.error.URLError as error:
        return None, str(error.reason)
    except Exception as error:
        return None, str(error)


def _read_local_server_version(root: Path) -> str | None:
    cargo_toml = root / "PROJECTUS-SERVER" / "core" / "Cargo.toml"
    if not cargo_toml.exists():
        return None
    try:
        body = cargo_toml.read_text(encoding="utf-8")
    except OSError:
        return None
    match = re.search(r'(?m)^version\s*=\s*"([^"]+)"', body)
    return match.group(1) if match else None
