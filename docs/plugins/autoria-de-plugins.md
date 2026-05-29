# Autoria de plugins

Como escrever, empacotar, assinar e instalar um plugin de PROJECTUS. Para o desenho
geral veja [arquitetura.md](arquitetura.md). Para um exemplo completo de uma feature
nativa empacotada como plugin veja [notes-como-plugin.md](notes-como-plugin.md).

Um plugin é um pacote `.zip` com um `manifest.json` na raiz, um entry-point ESM de
frontend e os assets que ele precisar. O backend valida e verifica o pacote; o host da
SPA carrega o entry com o loader ESM nativo e chama `activate(ctx)`.

## Layout do `.zip`

```text
meu-plugin.zip
  manifest.json        # obrigatório, na raiz (ou um nível abaixo, ver nota)
  index.js             # o frontend_entry — ESM com export activate(ctx)
  assets/              # opcional — imagens, CSS, etc. servidos como estáticos
    icon.svg
```

Nota: o instalador tolera um único diretório de embrulho no topo (o formato comum de
`git archive`/release do GitHub: `meu-plugin-1.0.0/manifest.json`). Mais de um
`manifest.json`, ou nenhum, é recusado. Entradas com caminho inseguro (zip-slip) são
recusadas. O teto de um pacote baixado por URL é 64 MiB.

Há uma fixture mínima e real em `plugins/__fixtures__/sample-plugin/` (um `manifest.json`
+ `index.js`) usada pelos testes de instalação do backend e do loader do frontend.
Manifestos de exemplo mais ricos (um por categoria: backup R2, IA, GitHub, mind-map,
smart-links) estão em [`exemplos/`](exemplos/) — úteis como ponto de partida para um
`manifest.json` próprio.

## Esquema do `manifest.json`

A autoridade de validação é o Rust (`crates/server/src/plugins/manifest.rs::validate`);
o espelho TypeScript fiel está em `apps/web/src/plugins/types/manifest.ts`. Campos do
contrato de plugin são em **inglês** (é a superfície voltada ao marketplace, não uma
entidade de domínio PROJECTUS — os identificadores de domínio como `titulo`, `cor`,
`notas`, `revision` continuam em português no resto do app).

```json
{
  "id": "meu-plugin",
  "title": "Meu Plugin",
  "short_description": "Uma linha.",
  "long_description": "Descrição completa para a tela de detalhes.",
  "version": "1.0.0",
  "author": "Você",
  "publisher": "voce",
  "homepage": "https://exemplo.com",
  "repository": "https://exemplo.com/meu-plugin.git",
  "license": "MIT",
  "icon": "Lightbulb",
  "screenshots": [],
  "changelog": "1.0.0 - primeira versão.",
  "min_api_version": 7,
  "api_version_range": { "min": 7, "max": 7 },
  "frontend_entry": "index.js",
  "backend_entry": null,
  "storage_schema_version": 1,
  "migrations": [],
  "extension_points": ["navItem", "screen"],
  "permissions": ["screens:add", "file:storage"],
  "shortcuts": [{ "id": "abrir", "keys": "mod+shift+m", "description": "Abrir Meu Plugin" }],
  "commands": [{ "id": "rodar", "title": "Rodar Meu Plugin", "description": "" }],
  "interacts_with": ["SIDE_NAVIGATION", "FILE_STORAGE"],
  "conflicts": [],
  "integrity": { "package_sha256": "", "manifest_sha256": "", "algorithm": "sha256" },
  "signature": null,
  "marketplace": { "category": "productivity", "tags": ["exemplo"], "verified": false }
}
```

### Campos

| Campo | Tipo | Regra |
| --- | --- | --- |
| `id` | string | **Obrigatório.** Slug `[a-z0-9-]+`. É a chave do registro/lockfile e o nome da pasta em disco. |
| `title` | string | **Obrigatório.** Não-vazio. |
| `version` | string | **Obrigatório.** Semver-ish `MAJOR.MINOR.PATCH` (sufixo `-prerelease` / `+build` aceito). |
| `frontend_entry` | string | **Obrigatório.** Caminho do entry ESM relativo à raiz do pacote (ex.: `index.js`). |
| `backend_entry` | string \| null | Opcional. `null` para plugin somente-frontend (o caso suportado hoje). |
| `min_api_version` | number | Menor versão de API do host tolerada. Deve ser `<= api_version_range.max`. |
| `api_version_range` | `{min,max}` | Janela inclusiva de compatibilidade. `min > max` é inválido. Default `{API_VERSION, API_VERSION}` (hoje 7). |
| `storage_schema_version` | number | Versão do schema do store de dados do plugin. |
| `migrations` | `{from,to,description}[]` | Passos de migração que o host roda em ordem quando `storage_schema_version` avança. |
| `extension_points` | string[] | Cada item deve ser um ponto de extensão conhecido (ver tabela abaixo). |
| `permissions` | string[] | Cada item deve ser uma permissão conhecida. |
| `interacts_with` | string[] | Cada item deve ser uma superfície de interação conhecida. |
| `conflicts` | string[] | Ids de outros plugins com os quais este não pode coexistir. |
| `integrity` | objeto | `algorithm` **deve** ser `sha256`. Qualquer outro valor (incluindo `md5`) é recusado. |
| `signature` | objeto \| null | Bloco Ed25519 ou `null` (sem assinatura). |

`validate()` checa, em ordem: campos obrigatórios não-vazios, `version` semver-ish, `id`
slug, faixa de API sã (incluindo `min_api_version`), `integrity.algorithm == sha256`, e
que toda permissão / interação / ponto de extensão declarado pertence ao vocabulário do
host. Um item desconhecido falha a instalação.

## Pontos de extensão

O host expõe pontos de extensão (vocabulário do backend em `ExtensionPoint`; as formas
de contribuição em `apps/web/src/plugins/types/extension-points.ts`). Um manifesto só
pode mirar os pontos que o host de fato renderiza.

| `extension_points` (manifesto) | Contribuição | O que entrega |
| --- | --- | --- |
| `navItem` / `nav-section` | `NavItemContribution` | Entrada na navegação lateral (`{ label, icon, screen, order? }`). |
| `screen` / `route` | `ScreenContribution` | Uma tela roteada, renderizada quando a tela ativa é o `id`. |
| `settingsPanel` / `settings-panel` | `SettingsPanelContribution` | Um painel na tela de configurações. |
| `editorNode` | `EditorNodeContribution` | Um nó Lexical adicionado ao `nodeRegistry` compartilhado. |
| `editorTransformer` | `EditorTransformerContribution` | Um transformer de markdown anexado a `EXTENDED_TRANSFORMERS`. |
| `slashCommand` | `SlashCommandContribution` | Um comando `/` no editor. |
| `toolbarItem` / `toolbar` / `editor-toolbar` | `ToolbarItemContribution` | Um botão na toolbar do editor (gated por `slot`). |
| `searchProvider` / `search-provider` | `SearchProviderContribution` | Um provedor de resultados de busca global + aliases/cores de escopo. |
| `cardBadge` / `cardAction` / `context-menu` | `CardBadge`/`CardActionContribution` | Decoração/ação em cards de projeto ou tarefa. |
| `archiveIntegration` | `ArchiveIntegrationContribution` | Como a entidade do plugin aparece e é restaurada no arquivo. |
| `command` / `command-palette` | `CommandContribution` | Um comando na paleta. |
| `shortcut` | `ShortcutContribution` | Um atalho via o `ShortcutManager` (o único keydown sancionado). |
| `backgroundJob` | `BackgroundJobContribution` | Um job periódico enquanto o plugin está ativo. |
| `i18n` | `I18nContribution` | Dicionários por `Locale`, mesclados nos do host. |

### Permissões (`PermissionId`)

Cada superfície é gated por uma permissão; um registrar do `PluginContext` chama
`assertPermission(manifest, ...)` antes de fazer trabalho privilegiado, então usar uma
capacidade não-declarada lança no momento do uso.

`notes:read`, `notes:write`, `projects:read`, `tasks:read`, `screens:add`,
`settings:add`, `shortcuts:register`, `commands:register`, `search:provide`,
`editor:extend`, `archive:create`, `attachments`, `events`, `network`, `file:storage`,
`secrets`, `background-jobs`.

### Superfícies de interação (`InteractionId`)

Declaradas em `interacts_with` para tornar o acoplamento honesto e inspecionável:
`MARKDOWN_EDITOR`, `SIDE_NAVIGATION`, `GLOBAL_SEARCH`, `SETTINGS`, `PROJECT_CARDS`,
`TASK_CARDS`, `TAGS`, `ARCHIVE`, `BACKUP`, `SECRETS`, `NETWORK`, `FILE_STORAGE`,
`SHORTCUTS`, `BACKGROUND_JOBS`.

## O entry-point de frontend

O `frontend_entry` é um módulo ESM. Ele exporta `activate(ctx)` (e opcionalmente
`deactivate()`), como exports nomeados ou sob um `default`. O loader normaliza ambos.

```js
// index.js
export function activate(ctx) {
  // ctx.contributes / ctx.i18n / ctx.shortcuts / ctx.storage / ctx.has(...)
  ctx.contributes.addNavItem({ id: 'nav', label: 'Meu Plugin', icon: MeuIcone, screen: 'meu-plugin' })
  ctx.contributes.addScreen({ id: 'meu-plugin', render: (props) => /* ReactNode */ })
}

export function deactivate() {
  // libere apenas o estado local do módulo; o host faz unregisterPlugin(id) por você.
}

export default { activate, deactivate }
```

O `ctx` (`PluginContext`):

- `ctx.pluginId` / `ctx.manifest` — id e manifesto validado (read-only).
- `ctx.contributes.*` — registrars escopados (nav, screen, settings, editor, busca,
  cards, arquivo, comandos, jobs). Cada um carimba o `pluginId` automaticamente e é gated
  por permissão.
- `ctx.i18n.register(...)` — mescla dicionários por locale.
- `ctx.shortcuts.register(...)` — o **único** caminho sancionado para um atalho. Nunca
  faça `window.addEventListener('keydown', ...)`: o `ShortcutManager` é o dono único do
  keydown global, arbitra colisões e libera o atalho no disable.
- `ctx.storage` — o cliente revision-aware do store namespaceado do plugin (gated por
  `file:storage`). `read`/`write`/`update`, com `update` re-tentando em conflito.
- `ctx.has(permission)` — checa se o manifesto declara a permissão.

Carregamento e isolamento: builtins resolvem por `builtinRegistry`; externos por
`import()` da URL servida (`${apiBase}/plugins/<id>/<versão>/<entry>`). O modelo de
isolamento atual é o `DirectModuleSandbox` (módulo no realm do host, capability-gated só
pelo `PluginContext`); o `IframeSandbox` é o stub documentado de isolamento por realm
futuro. **Nunca `eval`**.

## Assinatura e integridade

Há duas checagens independentes, ambas no backend (`signing.rs`), que colapsam num
`TrustStatus`:

1. **Integridade — SHA-256, obrigatória.** O backend recomputa o SHA-256 sobre os bytes
   exatos do pacote. Se o manifesto fixar `integrity.package_sha256`, ele **deve** bater;
   um mismatch é fatal e o plugin é recusado na hora. O `integrity.algorithm` deve ser
   `sha256` — **MD5 nunca é aceito em lugar nenhum**.
2. **Assinatura — Ed25519, opcional.** Uma assinatura sobre os bytes do manifesto, com
   chave pública e assinatura em base64 e um `publisher_identity`. Uma assinatura presente
   e inválida é fatal; uma válida eleva o veredito além de `unsigned`.

`TrustStatus`:

| Status | Significado |
| --- | --- |
| `verified` | Integridade ok + assinatura válida de um publisher confiável. |
| `signed-untrusted` | Integridade ok + assinatura criptograficamente válida, mas o publisher não está (ainda) na cadeia de confiança. |
| `unsigned` | Integridade ok, sem assinatura. |
| `mismatch` | SHA-256 não bateu ou a assinatura falhou. **Fatal**: nunca habilite. |

A cadeia de confiança de publishers (`TrustedPublishers`) é um scaffold: por padrão
confia em ninguém, então uma assinatura válida de um publisher desconhecido fica
`signed-untrusted`, nunca vira `verified` silenciosamente. Para gerar a assinatura,
assine os bytes do `manifest.json` com uma chave Ed25519 e preencha o bloco `signature`
(base64 da chave pública e da assinatura). Os digests (`package_sha256`,
`manifest_sha256`) podem ficar vazios no manifesto que você empacota: o backend recomputa
e grava os reais no registro/lockfile na instalação. O espelho `signing/integrity.ts`
no frontend só **exibe** o veredito (badges/tons) e oferece um SHA-256 via WebCrypto para
prévia local; nunca decide confiança.

## Fluxo de instalação

```text
upload .zip  ─┐
              ├─> install_package (install.rs)
download url ─┘     1. extrai num tempdir, acha manifest.json (zip-slip recusado)
                    2. PluginManifest::validate()           ← único portão de schema
                    3. recomputa SHA-256; se fixado, deve bater (senão Mismatch → recusa)
                    4. confere assinatura Ed25519 (presente+inválida → recusa)
                    5. unsigned exige allow_unsigned == true
                    6. grava em plugins/<id>/<versão>/, upsert no registro (DESABILITADO)
                       + regenera installed.lock.json
```

Pela SPA: a tela `plugins` (`PluginManagerView`) tem um `InstallPanel`. `pluginApi.install`
envia o `.zip` como multipart (`POST /api/plugins/install`); `pluginApi.installUrl` envia
`{ url, allow_unsigned }` (`POST /api/plugins/install-url`). Um pacote sem assinatura só
é admitido com o confirm explícito `allowUnsigned: true`. O plugin instala sempre
**desabilitado**: habilitar é uma ação separada e deliberada, e o backend recusa habilitar
um plugin `mismatch`.

Lifecycle pós-instalação (`/api/plugins`):

| Verbo / rota | Efeito |
| --- | --- |
| `GET /api/plugins` | Lista instalada com o pin do lockfile dobrado em cada linha. |
| `POST /api/plugins/{id}/enable` | Ativa (recusado em `mismatch`). |
| `POST /api/plugins/{id}/disable` | Desativa (sempre permitido). |
| `DELETE /api/plugins/{id}` | Desinstala, **preservando** `plugins/<id>/data/`. |
| `DELETE /api/plugins/{id}/data` | Purga o sandbox de dados (ação separada e explícita). |
| `GET /api/plugins/{id}/verify` | Recomputa a integridade contra o lockfile para flagrar adulteração. |
| `GET/PUT /api/plugins/{id}/data/{coleção}` | CRUD revisionado do store do plugin. |

Habilitar/desabilitar tem efeito **sem restart**: o host recarrega a linha, ativa/desativa
o módulo em lugar e re-renderiza os consumidores via a assinatura do registro.
