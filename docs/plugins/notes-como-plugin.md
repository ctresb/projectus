# Notes como plugin

Notes (a antiga feature Ideas, renomeada) é a prova de que uma feature nativa de
PROJECTUS pode ser um plugin de primeira classe sem nenhum acoplamento do core. Ela
vive inteiramente em `apps/web/src/plugins/builtin/notes/` e contribui tudo o que faz
através do contrato de plugin — não há um único `import` de Notes nos arquivos do core.

Para o desenho geral veja [arquitetura.md](arquitetura.md); para escrever o seu próprio
veja [autoria-de-plugins.md](autoria-de-plugins.md).

## Por que isso prova a tese

A regra anti-espaguete é: **arquivos do core nunca nomeiam um plugin**. Notes é o teste
de estresse dessa regra, porque era uma feature embutida (tela, busca, arquivo, atalho)
e mesmo assim foi extraída por completo para um builtin. Se o core continua funcionando
sem nomeá-la, qualquer plugin externo pode preencher o mesmo molde.

O único lugar no frontend onde o id `notes` aparece é `runtime/builtinRegistry.ts`
(`notes: () => import('../builtin/notes')`), e ele aparece como uma entrada de dados num
mapa de importadores, não como uma dependência. No backend, o único lugar é
`registry::seed_builtins`, que semeia o manifesto do Notes **como dado** em
`registry.json` na primeira inicialização. Todo o resto — Shell, App, busca, editor,
arquivo, configurações — lê o `PluginRegistry`.

## Onde Notes vive

```text
apps/web/src/plugins/builtin/notes/
  manifest.ts                 # o PluginManifest do builtin
  index.ts                    # activate(ctx) / deactivate() — registra tudo
  NotesView.tsx               # a tela (handle imperativo p/ quick-create)
  components/NotesList.tsx     # lista de cards de nota
  components/NoteEditor.tsx    # editor de uma nota (api.idea(id), anexos)
  notesApi.ts                  # cliente das notas
  search.ts                    # entries + aliases/cores de escopo para a busca
  i18n.ts                      # os dicionários que o Notes possui
  NotesView.test.tsx           # testes
```

## O que `activate(ctx)` contribui

`index.ts` registra, via os registrars escopados e gated por permissão do `PluginContext`:

| Contribuição | Ponto de extensão | Detalhe |
| --- | --- | --- |
| Dicionários i18n | `i18n` | `ctx.i18n.register({ dictionaries: NOTES_I18N })` — registrado **primeiro**, para que as chaves que o Notes agora possui (`ideas.*`, o label de nav `ideias`, o `idea` na busca, o label de entidade `ideia` no arquivo) resolvam mesmo que o core não as embarque mais. |
| Entrada de navegação | `navItem` (`screens:add`) | `ctx.contributes.addNavItem({ icon: Lightbulb, screen: NOTES_SCREEN, ... })`. |
| Tela roteada | `screen` (`screens:add`) | `ctx.contributes.addScreen` renderizando `NotesView` via um `NotesScreen` que puxa `config`/`notas`/`onNotes` do mesmo `useWorkspace` do host. |
| Provedor de busca | `searchProvider` (`search:provide`) | `entries` a partir do snapshot vivo que a tela publica, mais os aliases `note`/`notas` e a cor de acento mesclados nos mapas de busca do host. |
| Integração de arquivo | `archiveIntegration` (`archive:create`) | Como uma nota arquivada aparece e é restaurada; o `restore` chama `notesApi.notes()` + `api.archive()` + `api.restoreArchived(...)`. |
| Atalho quick-create | `shortcut` (`shortcuts:register`) | `mod+n`, roteado pelo `ShortcutManager` (não mais por um `window.addEventListener` na view); o handler dirige o handle imperativo do `NotesView`. |

`deactivate()` só solta o estado local do módulo (o handle da view, o snapshot de busca,
os tokens de navegação). As contribuições em si são derrubadas pelo host via
`unregisterPlugin(id)` e `ShortcutManager.unregisterPlugin(id)`, ambos escopados pelo
`pluginId` que o runtime carimbou em cada contribuição — então a desativação é uma
filtragem limpa, sem nada a desfazer manualmente.

## Detalhes que valem a pena

- **`activate` roda fora do React.** Os labels resolvidos no momento do registro (nav,
  label de entidade do arquivo) não podem usar o hook `useT`. O `index.ts` usa um
  `staticTranslator(locale)` que sobrepõe `NOTES_I18N` no dicionário base do host,
  espelhando o resolver do `I18nProvider`. As superfícies que rodam dentro do provider
  (a tela, a busca) usam o `useT` real.
- **Ponte React ↔ callbacks do host.** Dois bits de estado de módulo fazem a ponte: o
  `viewHandle` (handle imperativo do `NotesView`, para o atalho dirigir o quick-create
  sem um listener próprio) e o `searchState` (o último `{ t, notas }` que a tela publica,
  para o `entries()` do provedor de busca — chamado pelo host fora do React — construir a
  partir do snapshot atual).
- **`mod+n` é um acelerador reservado do host.** Registrar via `ctx.shortcuts` é o caminho
  correto e declarado mesmo assim: o `ShortcutManager` pode declinar o bind (o host é dono
  do "novo"), e registrar pelo contexto deixa o host arbitrar a colisão em vez de um
  listener clandestino vencer silenciosamente.

## Domínio em português, feature em inglês

A nomenclatura segue a regra do projeto: os identificadores de domínio continuam em
português (`notas`, `revision`, `titulo`, `cor`, `criado_em`, `atualizado_em`, `pasta`,
`projeto`, `tarefa`, `arquivo`). Só o nome da feature mudou de Ideia/Idea para Note/nota.
O contrato do manifesto (a superfície voltada ao marketplace) é em inglês.

No backend, a renomeação autoritativa já aterrissou: `IdeaCard → Note`,
`IdeasIndex → NotesIndex` (mantendo o campo interno `notas`), `CreateIdea → CreateNote`,
`UpdateIdea → UpdateNote`, o campo `Bootstrap.ideias → notes`, a pasta `ideias/ → notes/`,
o índice `ideias/ideas.json → notes/notes.json` (o `note.md` por nota fica), e a string de
entidade do arquivo `ideia → note`. Veja a migração em `formato-de-dados.md`.

No frontend, alguns identificadores de compatibilidade ainda usam o nome antigo de
propósito, porque a string atravessa fronteiras que o backend ainda tagueia como `idea`:
o alvo de navegação da busca global (`{ type: 'idea', ideaId }`) e o `entityType: 'ideia'`
da integração de arquivo do Notes. São strings de contrato, não nomes de feature; o
plugin as traduz na fronteira (o `NotesScreen` adapta o `idea` target para o `{ id, token }`
do `NotesView`).

## A história do `manifest.ts` do builtin

O manifesto declara `id: 'notes'`, os pontos de extensão e permissões acima, os
`interacts_with` (`MARKDOWN_EDITOR`, `SIDE_NAVIGATION`, `GLOBAL_SEARCH`, `ARCHIVE`,
`FILE_STORAGE`) e o atalho `mod+n`. Sendo um builtin:

- ele embarca no bundle do host, então é confiável na fronteira do módulo;
- o bloco `integrity` ainda carrega o marcador obrigatório `algorithm: 'sha256'` (nunca
  MD5); os digests concretos ficam vazios para o builtin em-bundle (não há pacote externo
  a comprometer);
- `signature` é `null` — um builtin não tem assinatura de publisher; sua confiança é ser
  parte do build. `seed_builtins` o registra com `TrustStatus::Unsigned` (o veredito
  honesto), não um `Verified` fabricado;
- `storage_schema_version: 1` com uma migração que registra o rename do store `ideias`
  para `notes`.

O manifesto Rust em `registry::notes_builtin_manifest` espelha esse mesmo documento, para
que o detector de conflitos e o portão de permissão raciocinem sobre o Notes sem rodá-lo.
