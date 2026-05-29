# Instalar um plugin (.zip) e onde os plugins ficam no disco

Este guia mostra como empacotar, instalar e testar um plugin externo, e explica
onde o PROJECTUS guarda os plugins instalados.

## Onde os plugins ficam no disco

Tudo do subsistema de plugins vive sob a **pasta de dados** do PROJECTUS, em:

```
~/Documents/PROJECTUS/plugins/
├── registry.json            # plugins instalados (manifesto, estado, origem, confiança)
├── installed.lock.json      # pin de integridade (SHA-256) de cada plugin
└── <id>/<versão>/           # árvore extraída de cada plugin externo
    ├── manifest.json
    └── index.js             # (o frontend_entry servido como ESM)
```

Ao instalar um `.zip`, o backend (único escritor durável):

1. valida o `manifest.json` contra o schema (versão da API, permissões/interações
   conhecidas, integridade SHA-256 — nunca MD5);
2. calcula o `package_sha256` e grava o pin no `installed.lock.json`;
3. **extrai** a árvore do pacote para `plugins/<id>/<versão>/`;
4. registra o plugin como **desativado** por padrão (ativar é um passo explícito).

Plugins **builtin** (como o **Notas**) não têm pacote externo: vêm com o app e são
semeados no `registry.json` já como **ativados**.

## O plugin de exemplo

Fonte: `plugins/examples/sample-hello/` (`manifest.json` + `index.js`).
Ele adiciona uma aba "Exemplo" na navegação, uma tela própria e um atalho
`Cmd/Ctrl+Shift+E`. É **sem assinatura** — serve só para exercitar o fluxo de
instalação.

### 1. Empacotar

```sh
./scripts/build-sample-plugin.sh
# gera: plugins/examples/sample-hello.zip
```

### 2. Instalar pela interface

1. Abra a tela **plugins** (navegação lateral).
2. Marque **"permitir plugins não assinados"** (o pacote de exemplo não é
   assinado; sem isso a instalação é recusada).
3. **Arraste** `plugins/examples/sample-hello.zip` para a área de drop — ou cole
   uma URL de um `.zip` e clique **instalar**.
4. O plugin aparece na lista como **desativado**, com detalhes (permissões,
   interações, atalho, selo de confiança = "não assinado", digest SHA-256).
5. Clique **ativar**. Sem reiniciar: a aba **Exemplo** surge na navegação e o
   atalho `Cmd/Ctrl+Shift+E` passa a funcionar.
6. **Desativar** remove a aba/atalho na hora; **desinstalar** remove o registro e
   a árvore extraída (preservando dados); o `.zip` adulterado → `Mismatch` →
   ativação bloqueada.

### Como um plugin externo renderiza UI sem bundler

Um `.zip` externo é um ESM autônomo (sem React empacotado). O host publica sua
própria instância de React em `globalThis.__PROJECTUS_PLUGIN_RUNTIME__.react`
**antes** de ativar qualquer plugin externo (veja
`apps/web/src/plugins/runtime/externalHostRuntime.ts`). O `index.js` do exemplo
lê esse React para construir a tela com `react.createElement(...)`. O código é
carregado com o loader nativo de ESM (`import(url)`) — **nunca** `eval`.

## Notas (builtin) — pré-instalado

O **Notas** é a prova de que um recurso nativo pode viver como plugin: já vem
**instalado e ativado**. Para vê-lo no fluxo de plugins, abra a tela **plugins**
→ ele aparece como pré-instalado/ativado. **Desativar** o Notas faz a aba, a tela
e os resultados de busca sumirem (sem navegação quebrada; os dados em
`~/Documents/PROJECTUS/notes/` ficam intactos). **Reativar** traz de volta, sem
reiniciar.
