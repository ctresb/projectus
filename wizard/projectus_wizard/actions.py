from __future__ import annotations

from pathlib import Path

from . import macos
from .commands import LogFn, run_command
from .i18n import I18n
from .status import inspect_environment


async def build_desktop_macos(root: Path, log: LogFn, i18n: I18n) -> None:
    await log(i18n.t("desktop.building"))
    await run_command(
        ["pnpm", "--filter", "@projectus/desktop", "tauri", "build", "--bundles", "dmg"],
        cwd=root,
        log=log,
    )
    dmg = macos.latest_desktop_dmg(root)
    if dmg is None:
        raise FileNotFoundError(i18n.t("desktop.dmg_missing"))
    installer = macos.preserve_installer(dmg, root)
    await log(i18n.t("desktop.dmg_ready", path=dmg))
    await log(i18n.t("desktop.installer_saved", path=installer))
    await macos.reveal_in_finder(dmg, root, log)
    await macos.open_dmg(dmg, root, log)
    await log(i18n.t("desktop.opened"))


async def build_server_macos(root: Path, log: LogFn, i18n: I18n) -> None:
    await log(i18n.t("server.build_app"))
    await run_command(
        ["pnpm", "--filter", "@projectus/server-app", "tauri", "build", "--bundles", "dmg"],
        cwd=root,
        log=log,
    )
    dmg = macos.latest_server_dmg(root)
    if dmg is None:
        raise FileNotFoundError(i18n.t("server.dmg_missing"))
    installer = macos.preserve_installer(dmg, root)
    await log(i18n.t("server.dmg_ready", path=dmg))
    await log(i18n.t("server.installer_saved", path=installer))
    await macos.reveal_in_finder(dmg, root, log)
    await macos.open_dmg(dmg, root, log)
    await log(i18n.t("server.opened"))

    await log(i18n.t("server.build_headless"))
    await run_command(
        ["cargo", "build", "--release", "-p", "projectus-server", "--manifest-path", str(root / "Cargo.toml")],
        cwd=root,
        log=log,
    )
    await log(i18n.t("server.headless_ready", path=macos.release_server_binary(root)))


async def restart_server_macos(root: Path, log: LogFn, i18n: I18n) -> None:
    await log(i18n.t("server.restarting"))
    await macos.install_or_restart_daemon(root, log)


async def build_all_macos(root: Path, log: LogFn, i18n: I18n) -> None:
    await build_desktop_macos(root, log, i18n)
    await build_server_macos(root, log, i18n)


async def report_environment(root: Path, log: LogFn, i18n: I18n) -> None:
    state = inspect_environment(root)
    await log(i18n.t("status.header"))
    if state.server_running and state.server_health:
        health = state.server_health
        version = health.get("server_version")
        api_version = health.get("api_version", i18n.t("value.unavailable"))
        await log(i18n.t("status.server_running", port=macos.LOCAL_PORT))
        if version:
            await log(i18n.t("status.server_version", version=version))
        elif state.local_server_version:
            await log(i18n.t("status.server_version_local", version=state.local_server_version))
        else:
            await log(i18n.t("status.server_version_unavailable"))
        await log(i18n.t("status.api_version", version=api_version))
        await log(i18n.t("status.configured_port", port=health.get("porta", i18n.t("value.unavailable"))))
        await log(i18n.t("status.data_root", root=health.get("raiz", i18n.t("value.unavailable"))))
    elif state.server_running and state.server_discovery:
        discovery = state.server_discovery
        await log(i18n.t("status.server_discovered", port=macos.LOCAL_PORT))
        await log(i18n.t("status.server_version", version=discovery.get("versao", i18n.t("value.unavailable"))))
        await log(i18n.t("status.api_version", version=discovery.get("api_version", i18n.t("value.unavailable"))))
        if state.server_error:
            await log(i18n.t("status.health_token_required", error=state.server_error))
    else:
        await log(i18n.t("status.server_stopped", error=state.server_error or i18n.t("value.no_response")))

    await log(
        i18n.t(
            "status.server_app_launch_agent",
            state=i18n.t("value.installed" if state.server_app_launch_agent_installed else "value.not_installed"),
            path=state.server_app_launch_agent_path,
        )
    )
    await log(
        i18n.t(
            "status.headless_launch_agent",
            state=i18n.t("value.installed" if state.headless_launch_agent_installed else "value.not_installed"),
            path=state.headless_launch_agent_path,
        )
    )
    await log(
        i18n.t(
            "status.binary",
            state=i18n.t("value.exists" if state.release_binary_exists else "value.missing"),
            path=state.release_binary,
        )
    )
    if state.desktop_app_installed:
        await log(i18n.t("status.desktop_app_installed", state=i18n.t("value.yes"), path=state.desktop_app_path))
        await log(i18n.t("status.desktop_app_version", version=state.desktop_app_version or i18n.t("value.unavailable")))
    else:
        await log(i18n.t("status.desktop_app_installed", state=i18n.t("value.no"), path=state.desktop_app_path))
    if state.server_app_installed:
        await log(i18n.t("status.server_app_installed", state=i18n.t("value.yes"), path=state.server_app_path))
        await log(i18n.t("status.server_app_version", version=state.server_app_version or i18n.t("value.unavailable")))
    else:
        await log(i18n.t("status.server_app_installed", state=i18n.t("value.no"), path=state.server_app_path))
