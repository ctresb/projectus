# Formato de dados

## Escrita

O backend Rust é o único escritor. `board.json`, `project.json`, `notes/notes.json` e `config.json` carregam uma `revision`; alterações que chegam com revisão antiga retornam `409` para impedir perda de dados entre desktop e celular.

Arquivos são gravados em temporário e promovidos por `rename`. A pasta do item inclui um ID aleatório de oito caracteres e não muda quando o título é editado.

## Markdown

`project.md`, `card.md` e `note.md` usam Markdown portátil. A primeira linha é sempre `# <título>` e é atualizada pelo backend junto com o índice JSON. Checklists seguem `- [ ]` e `- [x]`. Imagens são arquivos locais referenciados no Markdown.

## Notas (`notes/`)

O store de Notas vive em `notes/`: o índice `notes/notes.json` (`{ revision, notas }`) e, por nota, `notes/<slug>-<id8>/note.md`. É a antiga feature Ideas renomeada para Note/nota; os identificadores de domínio internos continuam em português (`notas`, `revision`, `titulo`, `cor`, `criado_em`, `atualizado_em`, `pasta`).

Migração de instalações antigas: na primeira inicialização, se `notes/` ainda não existe e há um `ideias/` legado, o backend move a pasta inteira (`ideias/ → notes/`), renomeia o índice (`ideias/ideas.json → notes/notes.json`) e reescreve as entradas do arquivo (`entidade == "ideia"` vira `"note"`), registrando o evento `notes_migradas` no histórico. Nenhum dado é apagado. Se as duas pastas coexistirem, `ideias/` é mantida intacta e a migração é ignorada com um aviso.

## Plugins (`plugins/`)

O subsistema de plugins guarda tudo em `plugins/`, ao lado de `projetos/`, `notes/`, `arquivo/` e `lixeira/`:

```text
plugins/
  registry.json            # registro rico e mutável de cada plugin instalado
  installed.lock.json       # lockfile slim que fixa a integridade (digests + assinatura)
  <id>/<versão>/             # a árvore extraída do pacote (manifest.json + frontend + assets)
  <id>/data/<coleção>.json   # o store de dados namespaceado e revisionado do plugin
```

- `registry.json` carrega, por plugin, o manifesto completo, o estado (`enabled`/`disabled`), a origem (`builtin`/`zip`/`url`), o timestamp de primeira instalação e o veredito de confiança (`TrustStatus`).
- `installed.lock.json` fixa, por plugin, os digests SHA-256 do pacote e do manifesto e a assinatura, para que um `verify` posterior recompute a confiança sem confiar cegamente no `registry.json`. Os dois são reescritos em conjunto e atomicamente.
- Cada `<id>/data/<coleção>.json` é um envelope `{ revision, items }`. Escritas seguem a mesma concorrência otimista (read-revision / write-revision / `409`) do resto do PROJECTUS, sob o mutex global de escrita.
- Desinstalar remove a árvore `<id>/<versão>/` mas preserva `<id>/data/`; purgar os dados é uma ação separada e explícita.

SHA-256 é a checagem de integridade obrigatória em todo o subsistema; MD5 nunca é aceito. Detalhes em [plugins/formato](plugins/arquitetura.md) e [plugins/autoria](plugins/autoria-de-plugins.md).

## Histórico

`history.json` registra operações estruturais, timestamp UTC e hash SHA-256 quando conteúdo Markdown muda. O histórico completo de conteúdo é fornecido pelos snapshots integrais do R2.
