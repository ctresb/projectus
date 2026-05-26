#!/bin/zsh
# Atalho de duplo-clique: compila o PROJECTUS e abre a janela do Finder
# clássica pra arrastar o .app pra Applications.
#
# Como usar:
#   - duplo-clique neste arquivo no Finder
#   - OU: ./INSTALAR.command
#   - OU: pnpm instalar
set -e
cd "$(dirname "$0")"
exec ./scripts/instalar.sh "$@"
