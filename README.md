![Projectus logo](logo.png)
# PROJECTUS

Kanban local para projetos, tarefas e ideias. A fonte de verdade fica em `~/Documents/PROJECTUS`, em JSON para estrutura e Markdown/anexos para conteúdo. A interface funciona no desktop Tauri para macOS e no navegador privado pela sua tailnet.

## Stack

- React, Vite, TypeScript, Motion, Lucide, dnd-kit e MDXEditor.
- Rust, Axum, arquivos atômicos, SSE e Cloudflare R2 via API S3.
- Tauri v2 para a janela macOS.
- `launchd` para manter o backend ativo no login.

## Convenções de frontend

As regras estritas da UI (tokens, tipografia, cores, BEM, lint, checklist de nova feature) estão em [GUIDELINES.md](GUIDELINES.md). Leia antes de mexer em qualquer `.tsx` ou `.css`.

## Desenvolvimento

```bash
pnpm install
cargo run -p projectus-server
pnpm dev
```

Abra `http://localhost:5173`. O Vite encaminha `/api` e `/conteudo` ao backend em `127.0.0.1:4387`.

Para testar o build servido diretamente pelo backend:

```bash
pnpm build
cargo run -p projectus-server
```

Abra `http://127.0.0.1:4387`.

## Desktop e servidor permanente

O app Tauri inicia a API local enquanto sua janela estiver aberta. Para acesso pelo celular, snapshots automáticos e uso mesmo com a janela fechada, instale o servidor permanente no Mac:

```bash
chmod +x scripts/instalar-autostart.sh scripts/remover-autostart.sh
./scripts/instalar-autostart.sh
pnpm desktop:dev
```

O script compila `projectus-server` em release e registra `~/Library/LaunchAgents/com.projectus.server.plist` com `RunAtLoad` e `KeepAlive`. Quando o daemon já estiver ativo, o app desktop apenas consome essa mesma API, sem iniciar outro scheduler.

Para criar o aplicativo e o instalador:

```bash
pnpm desktop:build
```

Os bundles macOS são gerados em `target/release/bundle/macos` e `target/release/bundle/dmg`.

### Instalador DMG (macOS, arrasta-pra-Applications)

Estilo clássico macOS — gera o `.dmg`, abre o Finder com a janela "arraste para Applications" pronta:

```bash
pnpm instalar
# ou diretamente:
./scripts/instalar.sh
```

O script compila em release (primeira vez demora alguns minutos), gera `PROJECTUS_<versão>_aarch64.dmg` em `target/release/bundle/dmg/` e abre no Finder. Layout da janela: `PROJECTUS.app` à esquerda, atalho para `Applications` à direita. Arraste o ícone, ejete o DMG, abra pelo Launchpad.

Flags:

- `--apenas-build` só compila, não abre o Finder.
- `--daemon` instala também o daemon launchd após o build.

Os dados continuam em `~/Documents/PROJECTUS`. Todas as personalizações (cor principal, colunas, tags, paleta de cores) ficam em `config.json` e fazem parte dos snapshots R2 — portanto sincronizam entre máquinas. Apenas as credenciais R2 (access + secret key) ficam no Keychain local e precisam ser refixadas em cada máquina.

## Acesso via Tailscale

Com o daemon ativo e a SPA compilada em `apps/web/dist`, publique apenas dentro da tailnet:

```bash
tailscale serve --bg http://127.0.0.1:4387
```

Não há autenticação adicional no v1. Controle o acesso pelas ACLs e dispositivos autorizados no Tailscale.

## Dados locais

```text
~/Documents/PROJECTUS/
  config.json
  board.json
  history.json
  projetos/<slug>-<id8>/
    project.json
    project.md
    history.json
    _anexos/
    tarefas/<slug>-<id8>/card.md
  ideias/
    ideas.json
    <slug>-<id8>/note.md
```

Google Drive e iCloud não fazem parte do código. Configure esses clientes para copiar a pasta local se desejar.

## R2

Em `config`, informe endereço S3, bucket e as chaves R2 e use `fixar configuração e credenciais`. A interface confirma que as chaves estão protegidas no Keychain do macOS sem exibir o segredo. O botão `[SAVE]` envia uma cópia completa. O daemon também cria um snapshot após 24 horas sem backup.

```text
r2-syncs/
  history.json
  <timestamp>-<id8>/
    PROJECTUS/...
    manifest.json
```

Na restauração, todos os checksums SHA-256 são validados e a pasta atual é preservada como `PROJECTUS-recuperacao-<timestamp>-<id8>`.

## Validação

```bash
pnpm typecheck
pnpm test
pnpm build
cargo test --workspace
```

<p align="center">
  <a href="https://c3b.fun/r/projectus" aria-label="C3B">
    <img src="https://img.shields.io/badge/C3B-feito%20por%20ctresb-ff5f7e?style=for-the-badge" alt="C3B" />
  </a>
</p>
