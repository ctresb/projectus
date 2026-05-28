from __future__ import annotations

import locale
import os


STRINGS = {
    "pt_BR": {
        "app.subtitle": "Wizard de build e ambiente do PROJECTUS",
        "app.hint": "Use setas e Enter. Esc volta. Q sai.",
        "app.ready": "PROJECTUS wizard pronto.",
        "app.copy_logs": "Logs copiados para a área de transferência.",
        "app.copy_logs_empty": "Não há logs para copiar.",
        "app.copy_logs_failed": "Não foi possível copiar os logs: {error}",
        "app.clear_logs": "Logs limpos.",
        "menu.title": "O que você quer fazer?",
        "menu.desktop": "Compilar programa",
        "menu.server": "Compilar servidor",
        "menu.all": "Fazer tudo",
        "menu.status": "Verificar ambiente",
        "menu.exit": "Sair",
        "platform.title": "{title}: escolha a plataforma",
        "platform.todo": "Opção ainda não disponível. Linux e Windows ficam marcados como [TO-DO].",
        "server.confirm.title": "Executar servidor agora?",
        "server.confirm.run": "Sim, atualizar e iniciar daemon",
        "server.confirm.skip": "Não, apenas deixar compilado",
        "server.confirm.back": "Voltar ao menu",
        "server.skip": "Servidor compilado. Execução ignorada.",
        "run.executing": "Executando...",
        "run.done": "Concluído.",
        "nav.back": "Voltar",
        "log.title": "LOG",
        "action.desktop": "Compilar programa",
        "action.server": "Compilar servidor",
        "action.all": "Fazer tudo",
        "action.status": "Verificar ambiente",
        "desktop.generating_icons": ">> gerando ícones a partir de {path}...",
        "desktop.icon_source_missing": "Ícone base não encontrado: {path}",
        "desktop.building": ">> compilando aplicativo macOS...",
        "desktop.dmg_missing": "DMG não encontrado em target/release/bundle/dmg",
        "desktop.dmg_ready": "DMG pronto: {path}",
        "desktop.opened": "Instalador aberto. Arraste PROJECTUS.app para Applications.",
        "server.build_frontend": ">> compilando frontend para o servidor...",
        "server.build_release": ">> compilando servidor release...",
        "server.ready": "Servidor pronto: {path}",
        "server.restarting": ">> atualizando LaunchAgent e reiniciando servidor...",
        "status.header": ">> ambiente PROJECTUS",
        "status.server_running": "Servidor: rodando em 127.0.0.1:{port}",
        "status.server_version": "Versão servidor: {version}",
        "status.server_version_local": "Versão servidor: {version} (local; daemon atual ainda não expõe server_version)",
        "status.server_version_unavailable": "Versão servidor: indisponível",
        "status.api_version": "Versão da API: {version}",
        "status.configured_port": "Porta configurada: {port}",
        "status.data_root": "Raiz de dados: {root}",
        "status.server_stopped": "Servidor: parado ou inacessível ({error})",
        "status.launch_agent": "LaunchAgent: {state} ({path})",
        "status.binary": "Binário release: {state} ({path})",
        "status.app_installed": "App instalado: {state} ({path})",
        "status.app_version": "Versão do app: {version}",
        "value.installed": "instalado",
        "value.not_installed": "não instalado",
        "value.exists": "existe",
        "value.missing": "não encontrado",
        "value.yes": "sim",
        "value.no": "não",
        "value.unavailable": "indisponível",
        "value.no_response": "sem resposta",
        "binding.quit": "Sair",
        "binding.back": "Voltar",
        "binding.copy_logs": "Copiar logs",
        "binding.clear_logs": "Limpar logs",
    },
    "en_US": {
        "app.subtitle": "PROJECTUS build and environment wizard",
        "app.hint": "Use arrows and Enter. Esc goes back. Q quits.",
        "app.ready": "PROJECTUS wizard ready.",
        "app.copy_logs": "Logs copied to clipboard.",
        "app.copy_logs_empty": "There are no logs to copy.",
        "app.copy_logs_failed": "Could not copy logs: {error}",
        "app.clear_logs": "Logs cleared.",
        "menu.title": "What do you want to do?",
        "menu.desktop": "Build app",
        "menu.server": "Build server",
        "menu.all": "Do everything",
        "menu.status": "Check environment",
        "menu.exit": "Exit",
        "platform.title": "{title}: choose platform",
        "platform.todo": "Option unavailable. Linux and Windows are marked as [TO-DO].",
        "server.confirm.title": "Run server now?",
        "server.confirm.run": "Yes, update and start daemon",
        "server.confirm.skip": "No, leave it built only",
        "server.confirm.back": "Back to menu",
        "server.skip": "Server built. Run skipped.",
        "run.executing": "Running...",
        "run.done": "Done.",
        "nav.back": "Back",
        "log.title": "LOG",
        "action.desktop": "Build app",
        "action.server": "Build server",
        "action.all": "Do everything",
        "action.status": "Check environment",
        "desktop.generating_icons": ">> generating icons from {path}...",
        "desktop.icon_source_missing": "Base icon not found: {path}",
        "desktop.building": ">> building macOS app...",
        "desktop.dmg_missing": "DMG not found in target/release/bundle/dmg",
        "desktop.dmg_ready": "DMG ready: {path}",
        "desktop.opened": "Installer opened. Drag PROJECTUS.app to Applications.",
        "server.build_frontend": ">> building frontend for the server...",
        "server.build_release": ">> building release server...",
        "server.ready": "Server ready: {path}",
        "server.restarting": ">> updating LaunchAgent and restarting server...",
        "status.header": ">> PROJECTUS environment",
        "status.server_running": "Server: running on 127.0.0.1:{port}",
        "status.server_version": "Server version: {version}",
        "status.server_version_local": "Server version: {version} (local; current daemon does not expose server_version yet)",
        "status.server_version_unavailable": "Server version: unavailable",
        "status.api_version": "API version: {version}",
        "status.configured_port": "Configured port: {port}",
        "status.data_root": "Data root: {root}",
        "status.server_stopped": "Server: stopped or unreachable ({error})",
        "status.launch_agent": "LaunchAgent: {state} ({path})",
        "status.binary": "Release binary: {state} ({path})",
        "status.app_installed": "App installed: {state} ({path})",
        "status.app_version": "App version: {version}",
        "value.installed": "installed",
        "value.not_installed": "not installed",
        "value.exists": "exists",
        "value.missing": "missing",
        "value.yes": "yes",
        "value.no": "no",
        "value.unavailable": "unavailable",
        "value.no_response": "no response",
        "binding.quit": "Quit",
        "binding.back": "Back",
        "binding.copy_logs": "Copy logs",
        "binding.clear_logs": "Clear logs",
    },
}


class I18n:
    def __init__(self, language: str | None = None) -> None:
        self.language = _normalize_language(language or detect_language())
        self.strings = STRINGS[self.language]

    def t(self, key: str, **values: object) -> str:
        text = self.strings.get(key, STRINGS["pt_BR"].get(key, key))
        return text.format(**values)


def detect_language() -> str:
    candidates = [
        os.environ.get("PROJECTUS_WIZARD_LANG"),
        os.environ.get("LC_ALL"),
        os.environ.get("LC_MESSAGES"),
        os.environ.get("LANG"),
        locale.getlocale()[0],
    ]
    for candidate in candidates:
        if candidate:
            return candidate
    return "pt_BR"


def _normalize_language(language: str) -> str:
    clean = language.replace("-", "_").split(".", 1)[0]
    return "pt_BR" if clean.lower().startswith("pt") else "en_US"
