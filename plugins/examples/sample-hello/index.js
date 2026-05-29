// PROJECTUS — plugin de exemplo instalável via .zip.
//
// Este é um ESM autônomo: NÃO tem bundler nem node_modules, então não pode
// `import 'react'`. Em vez disso lê o React do host pela ponte de runtime que o
// `PluginHost` publica antes de ativar qualquer plugin externo:
//
//   globalThis.__PROJECTUS_PLUGIN_RUNTIME__ = { react }
//
// O host carrega este arquivo com o loader nativo de ESM (`import(url)`), nunca
// com `eval`. `activate(ctx)` recebe o contexto de capacidades, com gate de
// permissões: este plugin declara `screens:add` e `shortcuts:register` no
// manifesto, exatamente as capacidades que usa abaixo.

const runtime = (typeof globalThis !== 'undefined' && globalThis.__PROJECTUS_PLUGIN_RUNTIME__) || {}
const react = runtime.react

/** Ícone da aba (recebe { size } do Shell; ignorado aqui). */
function HelloIcon() {
  return react.createElement('span', { style: { fontSize: 15, lineHeight: 1 } }, '◆')
}

/** Tela renderizada quando a aba do plugin está ativa. */
function HelloScreen() {
  return react.createElement(
    'section',
    { style: { padding: '48px', maxWidth: 760 } },
    react.createElement(
      'p',
      { style: { textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6, marginBottom: 8 } },
      'plugin de exemplo',
    ),
    react.createElement('h1', { style: { fontSize: 40, margin: '0 0 16px' } }, 'Olá do plugin instalado 👋'),
    react.createElement(
      'p',
      { style: { opacity: 0.8, lineHeight: 1.6 } },
      'Esta aba e esta tela foram adicionadas por um plugin externo, instalado a partir de um arquivo .zip. ' +
        'O pacote foi validado, teve seu SHA-256 calculado e foi extraído para a pasta de plugins em disco. ' +
        'Pressione Cmd/Ctrl+Shift+E para disparar o atalho registrado por este plugin.',
    ),
  )
}

export function activate(ctx) {
  if (!react) {
    throw new Error('runtime React do host indisponível: __PROJECTUS_PLUGIN_RUNTIME__ não inicializado')
  }

  // Aba na navegação lateral -> tela 'sample-hello' (gate: screens:add).
  ctx.contributes.addNavItem({ id: 'nav', label: 'Exemplo', icon: HelloIcon, screen: 'sample-hello' })

  // A tela roteada (gate: screens:add).
  ctx.contributes.addScreen({ id: 'sample-hello', render: () => react.createElement(HelloScreen) })

  // Atalho global pelo ShortcutManager do host (gate: shortcuts:register).
  // mod+shift+e não colide com os atalhos nativos (mod+k, mod+n).
  ctx.shortcuts.register({
    id: 'hello',
    keys: 'mod+shift+e',
    description: 'Plugin de exemplo: dizer olá',
    run: () => {
      try {
        window.alert('Plugin de exemplo: atalho Cmd/Ctrl+Shift+E disparado!')
      } catch {
        /* ambiente sem window (headless): ignora */
      }
    },
  })
}

export function deactivate() {
  // Nada de estado próprio para liberar: o host remove as contribuições e o
  // atalho deste plugin por id (unregisterPlugin) ao desativar.
}
