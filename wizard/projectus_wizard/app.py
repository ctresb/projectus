from __future__ import annotations

import os
from pathlib import Path

from rich.text import Text
from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.widgets import Footer, OptionList, RichLog, Static
from textual.widgets.option_list import Option

from . import actions
from .i18n import I18n
from .logo import load_logo
from .platforms import PLATFORMS
from .theme import CSS, ERROR, SUCCESS


class ProjectusWizard(App[None]):
    CSS = CSS
    BINDINGS = [
        ("q", "quit", "Sair"),
        ("escape", "back", "Voltar"),
    ]

    def __init__(self, root: Path) -> None:
        super().__init__()
        self.root = root
        self.i18n = I18n()
        self.mode = "main"
        self.pending_action: str | None = None
        self.running = False

    def compose(self) -> ComposeResult:
        with Container(id="root"):
            yield Static(load_logo(self.root), id="logo")
            yield Static(self.i18n.t("app.subtitle"), id="subtitle")
            with Horizontal(id="body"):
                with Vertical(id="menu-panel"):
                    yield Static("", id="screen-title")
                    yield OptionList(id="options")
                    yield Static(self.i18n.t("app.hint"), id="hint")
                with Vertical(id="log-panel"):
                    yield Static(self.i18n.t("log.title"), id="log-title")
                    yield RichLog(id="log", highlight=True, markup=False)
            yield Footer()

    async def on_mount(self) -> None:
        self._show_main()
        await self._log(self.i18n.t("app.ready"))

    async def on_option_list_option_selected(self, event: OptionList.OptionSelected) -> None:
        if self.running:
            return
        option_id = event.option_id or ""
        if self.mode == "main":
            await self._handle_main(option_id)
        elif self.mode == "platform":
            await self._handle_platform(option_id)
        elif self.mode == "server-confirm":
            await self._handle_server_confirm(option_id)

    def action_back(self) -> None:
        if self.running:
            return
        self._show_main()

    async def _handle_main(self, option_id: str) -> None:
        if option_id == "exit":
            self.exit()
        elif option_id == "desktop":
            self.pending_action = "desktop"
            self._show_platform(self.i18n.t("action.desktop"))
        elif option_id == "server":
            self.pending_action = "server"
            self._show_platform(self.i18n.t("action.server"))
        elif option_id == "all":
            self._start_run(self.i18n.t("action.all"), lambda: actions.build_all_macos(self.root, self._log, self.i18n))
        elif option_id == "status":
            self._start_run(
                self.i18n.t("action.status"),
                lambda: actions.report_environment(self.root, self._log, self.i18n),
            )

    async def _handle_platform(self, option_id: str) -> None:
        if option_id == "back":
            self._show_main()
            return
        if option_id != "macos":
            await self._log(self.i18n.t("platform.todo"))
            return
        if self.pending_action == "desktop":
            self._start_run(
                self.i18n.t("action.desktop"),
                lambda: actions.build_desktop_macos(self.root, self._log, self.i18n),
            )
        elif self.pending_action == "server":
            self._start_run(
                self.i18n.t("action.server"),
                lambda: actions.build_server_macos(self.root, self._log, self.i18n),
                after=self._show_server_confirm,
            )

    async def _handle_server_confirm(self, option_id: str) -> None:
        if option_id == "server-run":
            self._start_run(
                self.i18n.t("server.confirm.title"),
                lambda: actions.restart_server_macos(self.root, self._log, self.i18n),
            )
        elif option_id == "server-skip":
            await self._log(self.i18n.t("server.skip"))
            self._show_main()
        elif option_id == "back":
            self._show_main()

    def _start_run(self, title: str, work, after=None) -> None:
        self.running = True
        self.run_worker(self._run(title, work, after=after), exclusive=True, exit_on_error=False)

    async def _run(self, title: str, work, after=None) -> None:
        self.running = True
        self._set_options(title, [Option(self.i18n.t("run.executing"), id="running", disabled=True)])
        await self._log("")
        await self._log(f"== {title} ==")
        try:
            await work()
        except Exception as error:
            await self._log(Text(f"ERR / {error}", style=ERROR))
            self._show_main()
        else:
            await self._log(Text(self.i18n.t("run.done"), style=SUCCESS))
            if after is not None:
                after()
            else:
                self._show_main()
        finally:
            self.running = False

    def _show_main(self) -> None:
        self.mode = "main"
        self.pending_action = None
        self._set_options(
            self.i18n.t("menu.title"),
            [
                Option(self.i18n.t("menu.desktop"), id="desktop"),
                Option(self.i18n.t("menu.server"), id="server"),
                Option(self.i18n.t("menu.all"), id="all"),
                Option(self.i18n.t("menu.status"), id="status"),
                Option(self.i18n.t("menu.exit"), id="exit"),
            ],
        )

    def _show_platform(self, title: str) -> None:
        self.mode = "platform"
        options = [Option(platform.label, id=platform.id, disabled=not platform.enabled) for platform in PLATFORMS]
        options.append(Option(self.i18n.t("nav.back"), id="back"))
        self._set_options(self.i18n.t("platform.title", title=title), options)

    def _show_server_confirm(self) -> None:
        self.mode = "server-confirm"
        self._set_options(
            self.i18n.t("server.confirm.title"),
            [
                Option(self.i18n.t("server.confirm.run"), id="server-run"),
                Option(self.i18n.t("server.confirm.skip"), id="server-skip"),
                Option(self.i18n.t("server.confirm.back"), id="back"),
            ],
        )

    def _set_options(self, title: str, options: list[Option]) -> None:
        self.query_one("#screen-title", Static).update(title)
        option_list = self.query_one("#options", OptionList)
        option_list.clear_options()
        option_list.add_options(options)

    async def _log(self, message) -> None:
        log = self.query_one("#log", RichLog)
        log.write(message)


def project_root() -> Path:
    env_root = os.environ.get("PROJECTUS_ROOT")
    if env_root:
        return Path(env_root).resolve()
    return Path(__file__).resolve().parents[2]


def main() -> None:
    ProjectusWizard(project_root()).run()
