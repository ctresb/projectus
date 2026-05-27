from __future__ import annotations

import html
import os
import plistlib
from pathlib import Path

from .commands import LogFn, run_command

LABEL = "com.projectus.server"
LOCAL_PORT = 4387


def latest_dmg(root: Path) -> Path | None:
    dmg_dir = root / "target" / "release" / "bundle" / "dmg"
    candidates = list(dmg_dir.glob("PROJECTUS_*.dmg"))
    if not candidates:
        return None
    return max(candidates, key=lambda path: path.stat().st_mtime)


def release_server_binary(root: Path) -> Path:
    return root / "target" / "release" / "projectus-server"


def launch_agent_path() -> Path:
    return Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"


def installed_app_path() -> Path:
    return Path("/Applications/PROJECTUS.app")


def installed_app_version() -> str | None:
    info = installed_app_path() / "Contents" / "Info.plist"
    if not info.exists():
        return None
    try:
        with info.open("rb") as file:
            data = plistlib.load(file)
    except Exception:
        return "versao indisponivel"
    return (
        data.get("CFBundleShortVersionString")
        or data.get("CFBundleVersion")
        or "versao indisponivel"
    )


async def reveal_in_finder(path: Path, root: Path, log: LogFn) -> None:
    await run_command(["open", "-R", str(path)], cwd=root, log=log)


async def open_dmg(path: Path, root: Path, log: LogFn) -> None:
    await detach_projectus_volumes(root, log)
    await run_command(["open", str(path)], cwd=root, log=log)


async def detach_projectus_volumes(root: Path, log: LogFn) -> None:
    volumes = sorted(Path("/Volumes").glob("PROJECTUS*"))
    for volume in volumes:
        if volume.is_dir():
            await log(f">> desmontando volume anterior: {volume}")
            await run_command(["hdiutil", "detach", str(volume), "-quiet"], cwd=root, log=log, check=False)


async def install_or_restart_daemon(root: Path, log: LogFn) -> None:
    binary = release_server_binary(root)
    if not binary.exists():
        raise FileNotFoundError(f"binario nao encontrado: {binary}")

    plist = launch_agent_path()
    logs = Path.home() / "Library" / "Logs" / "PROJECTUS"
    plist.parent.mkdir(parents=True, exist_ok=True)
    logs.mkdir(parents=True, exist_ok=True)

    plist.write_text(_plist_body(root, binary, logs), encoding="utf-8")
    domain = f"gui/{os.getuid()}"
    await run_command(["launchctl", "bootout", domain, str(plist)], cwd=root, log=log, check=False)
    await run_command(["launchctl", "bootstrap", domain, str(plist)], cwd=root, log=log)
    await log(f"Servidor launchd ativo: {plist}")


def _plist_body(root: Path, binary: Path, logs: Path) -> str:
    web_dist = root / "apps" / "web" / "dist"
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>{LABEL}</string>
<key>ProgramArguments</key><array><string>{html.escape(str(binary))}</string></array>
<key>WorkingDirectory</key><string>{html.escape(str(root))}</string>
<key>EnvironmentVariables</key><dict>
<key>PROJECTUS_WEB_DIST</key><string>{html.escape(str(web_dist))}</string>
</dict>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>{html.escape(str(logs / "server.log"))}</string>
<key>StandardErrorPath</key><string>{html.escape(str(logs / "server.err.log"))}</string>
</dict></plist>
"""
