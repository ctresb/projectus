![Projectus logo](logo.png)
# PROJECTUS

Kanban local para projetos, tarefas e ideias. A fonte de verdade fica em `~/Documents/PROJECTUS`, em JSON para estrutura e Markdown/anexos para conteúdo. O `PROJECTUS-SERVER` mantém API/dados/snapshots e o `PROJECTUS` é o cliente desktop.

## Stack

- React, Vite, TypeScript, Motion, Lucide, dnd-kit e MDXEditor.
- Rust, Axum, arquivos atômicos, SSE e Cloudflare R2 via API S3.
- Tauri v2 para o cliente macOS e para o app de servidor na barra de menus.
- `launchd`/Keychain para autostart e segredos do `PROJECTUS-SERVER`.

## Desenvolvimento

```bash
pnpm install
PROJECTUS_SERVER_TOKEN=projectus_dev_token_com_mais_de_24_chars cargo run -p projectus-server -- --headless
pnpm dev
```

Abra `http://localhost:5173`, informe `http://127.0.0.1:4387` e o token.

Para testar o build servido diretamente pelo backend:

```bash
pnpm build
PROJECTUS_SERVER_TOKEN=projectus_dev_token_com_mais_de_24_chars cargo run -p projectus-server -- --headless
```

Abra `http://127.0.0.1:4387`.

## Desktop e PROJECTUS-SERVER

O app `PROJECTUS` não inicia mais backend. Instale e abra o `PROJECTUS-SERVER`; ele fica na barra de menus, gera um token no Keychain e expõe controles simples de status/autostart/token.

```bash
pnpm server-app:dev
pnpm desktop:dev
```

Para modo headless/cloud sem Docker neste ciclo, use o binário `projectus-server` com `PROJECTUS_SERVER_TOKEN` ou `--token`.

Para criar o aplicativo e o instalador:

```bash
pnpm desktop:build
pnpm server-app:build
```

Os bundles macOS são gerados em `target/release/bundle/macos` e `target/release/bundle/dmg`.

### Instalador DMG (macOS, arrasta-pra-Applications)

Estilo clássico macOS — gera o `.dmg`, abre o Finder com a janela "arraste para Applications" pronta:

```bash
pnpm instalar
./scripts/instalar.sh
./scripts/instalar-server.sh
```

Os scripts geram dois instaladores separados: `PROJECTUS_<versão>_aarch64.dmg` e `PROJECTUS-SERVER_<versão>_aarch64.dmg`. Instale os dois em Applications, abra primeiro o `PROJECTUS-SERVER`, copie o token e cole no `PROJECTUS`.

Flags:

- `--apenas-build` só compila, não abre o Finder.

Os dados continuam em `~/Documents/PROJECTUS`. Todas as personalizações (cor principal, colunas, tags, paleta de cores) ficam em `config.json` e fazem parte dos snapshots R2. Credenciais R2 e token do servidor ficam no Keychain do `PROJECTUS-SERVER`.

## Acesso via Tailscale

Com o daemon ativo e a SPA compilada em `apps/web/dist`, publique apenas dentro da tailnet:

```bash
tailscale serve --bg http://127.0.0.1:4387
```

Todas as rotas reais de API exigem `Authorization: Bearer <token>`. Controle também o acesso pelas ACLs e dispositivos autorizados no Tailscale.

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
