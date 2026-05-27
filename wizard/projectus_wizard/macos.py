from __future__ import annotations

import html
import os
import plistlib
from pathlib import Path

from .commands import LogFn, run_command

HEADLESS_LABEL = "com.projectus.server"
SERVER_APP_LABEL = "com.projectus.server-app"
LOCAL_PORT = 4387


def latest_desktop_dmg(root: Path) -> Path | None:
    dmg_dir = root / "target" / "release" / "bundle" / "dmg"
    candidates = list(dmg_dir.glob("PROJECTUS_*.dmg"))
    if not candidates:
        return None
    return max(candidates, key=lambda path: path.stat().st_mtime)


def latest_server_dmg(root: Path) -> Path | None:
    dmg_dir = root / "target" / "release" / "bundle" / "dmg"
    candidates = list(dmg_dir.glob("PROJECTUS-SERVER_*.dmg"))
    if not candidates:
        return None
    return max(candidates, key=lambda path: path.stat().st_mtime)


def preserve_installer(dmg: Path, root: Path) -> Path:
    target_dir = root / "target" / "release" / "bundle" / "installers"
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / dmg.name
    target.write_bytes(dmg.read_bytes())
    return target


def release_server_binary(root: Path) -> Path:
    return root / "target" / "release" / "projectus-server"


def server_app_launch_agent_path() -> Path:
    return Path.home() / "Library" / "LaunchAgents" / f"{SERVER_APP_LABEL}.plist"


def headless_launch_agent_path() -> Path:
    return Path.home() / "Library" / "LaunchAgents" / f"{HEADLESS_LABEL}.plist"


def installed_desktop_app_path() -> Path:
    return Path("/Applications/PROJECTUS.app")


def installed_server_app_path() -> Path:
    return Path("/Applications/PROJECTUS-SERVER.app")


def installed_app_version(app: Path) -> str | None:
    info = app / "Contents" / "Info.plist"
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
    token = os.environ.get("PROJECTUS_SERVER_TOKEN")
    if not token:
        raise RuntimeError("defina PROJECTUS_SERVER_TOKEN para iniciar o servidor headless via LaunchAgent")
    binary = release_server_binary(root)
    if not binary.exists():
        raise FileNotFoundError(f"binario nao encontrado: {binary}")

    plist = headless_launch_agent_path()
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
    token = os.environ["PROJECTUS_SERVER_TOKEN"]
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>{HEADLESS_LABEL}</string>
<key>ProgramArguments</key><array><string>{html.escape(str(binary))}</string></array>
<key>WorkingDirectory</key><string>{html.escape(str(root))}</string>
<key>EnvironmentVariables</key><dict>
<key>PROJECTUS_WEB_DIST</key><string>{html.escape(str(web_dist))}</string>
<key>PROJECTUS_SERVER_TOKEN</key><string>{html.escape(token)}</string>
</dict>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>{html.escape(str(logs / "server.log"))}</string>
<key>StandardErrorPath</key><string>{html.escape(str(logs / "server.err.log"))}</string>
</dict></plist>
"""
