# Formato de dados

## Escrita

O backend Rust é o único escritor. `board.json`, `project.json`, `ideas.json` e `config.json` carregam uma `revision`; alterações que chegam com revisão antiga retornam `409` para impedir perda de dados entre desktop e celular.

Arquivos são gravados em temporário e promovidos por `rename`. A pasta do item inclui um ID aleatório de oito caracteres e não muda quando o título é editado.

## Markdown

`project.md`, `card.md` e `note.md` usam Markdown portátil. A primeira linha é sempre `# <título>` e é atualizada pelo backend junto com o índice JSON. Checklists seguem `- [ ]` e `- [x]`. Imagens são arquivos locais referenciados no Markdown.

## Histórico

`history.json` registra operações estruturais, timestamp UTC e hash SHA-256 quando conteúdo Markdown muda. O histórico completo de conteúdo é fornecido pelos snapshots integrais do R2.
