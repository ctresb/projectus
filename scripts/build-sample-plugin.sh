#!/bin/zsh
# Empacota o plugin de exemplo (plugins/examples/sample-hello) num .zip
# instalável pela tela "plugins" do PROJECTUS (arrastar-e-soltar ou por URL).
#
# Saída: plugins/examples/sample-hello.zip — com manifest.json + index.js na
# raiz do zip (o backend localiza o manifest.json na raiz ou um nível abaixo).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/plugins/examples/sample-hello"
OUT="$ROOT/plugins/examples/sample-hello.zip"

if [[ ! -f "$SRC/manifest.json" || ! -f "$SRC/index.js" ]]; then
  echo "erro: faltam $SRC/manifest.json ou index.js" >&2
  exit 1
fi

rm -f "$OUT"
# -j NÃO usado: queremos os arquivos na raiz, então entramos no diretório.
( cd "$SRC" && zip -q -X "$OUT" manifest.json index.js )

echo "plugin empacotado: $OUT"
unzip -l "$OUT"
