// Presentational list of the host surfaces a plugin declares it cooperates with
// (`manifest.interacts_with`). Purely informational: it tells the user, in plain
// pt-BR, which host capabilities the plugin touches before they enable it.
//
// Each interaction id is mapped here to a user-facing { title, description } pair
// so the list reads as structured rows (a bold title + a muted description on
// their own lines), never raw bullets or glued metadata. Unknown ids fall back to
// a humanized form of the id so a new host surface still renders cleanly.

import { Text } from '../../../components/ui'
import type { InteractionId } from '../../types/interactions'
import type { TFn } from '../../../i18n'

/// A user-facing label + supporting line describing what the plugin cooperates
/// with. Title is the surface name; description says, in plain words, what
/// touching that surface means.
type InteractionCopy = { title: string; description: string }

/// pt-BR copy for every host surface in the closed `InteractionId` vocabulary.
/// Keyed by the manifest id; kept exhaustive via `Record<InteractionId, …>` so
/// adding a new surface is a compile error until copy exists for it.
const INTERACTION_COPY: Record<InteractionId, InteractionCopy> = {
  MARKDOWN_EDITOR: {
    title: 'Editor de markdown',
    description: 'Adiciona itens, nós ou formatação ao editor de markdown compartilhado.',
  },
  SIDE_NAVIGATION: {
    title: 'Navegação lateral',
    description: 'Coopera com a barra de navegação lateral do app.',
  },
  GLOBAL_SEARCH: {
    title: 'Busca global',
    description: 'Participa da busca global e da paleta de comandos (Cmd+K).',
  },
  SETTINGS: {
    title: 'Ajustes',
    description: 'Acrescenta opções na tela de ajustes.',
  },
  PROJECT_CARDS: {
    title: 'Cards de projeto',
    description: 'Adiciona selos ou ações aos cards de projeto.',
  },
  TASK_CARDS: {
    title: 'Cards de tarefa',
    description: 'Adiciona selos ou ações aos cards de tarefa.',
  },
  TAGS: {
    title: 'Tags',
    description: 'Coopera com o sistema de tags.',
  },
  ARCHIVE: {
    title: 'Arquivo',
    description: 'Usa o Arquivo do PROJECTUS.',
  },
  BACKUP: {
    title: 'Backup',
    description: 'Coopera com o subsistema de backup.',
  },
  SECRETS: {
    title: 'Segredos',
    description: 'Usa o cofre de segredos do app para guardar credenciais.',
  },
  NETWORK: {
    title: 'Rede',
    description: 'Faz conexões com a internet.',
  },
  FILE_STORAGE: {
    title: 'Armazenamento',
    description: 'Guarda dados próprios do plugin (não acessa seus arquivos no computador).',
  },
  SHORTCUTS: {
    title: 'Atalhos de teclado',
    description: 'Coopera com o gerenciador global de atalhos.',
  },
  BACKGROUND_JOBS: {
    title: 'Tarefas em segundo plano',
    description: 'Executa tarefas e timers em segundo plano.',
  },
}

/// Turns an unknown raw id (e.g. `SOME_SURFACE`) into a readable title
/// (`Some surface`): splits on `_`/`-`, lowercases, then capitalizes the first
/// letter. Falls back to the original id if it normalizes to empty.
function humanizeInteractionId(id: string): string {
  const words = id
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
  if (words.length === 0) return id
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/// Resolves the display copy for any interaction id, using the curated map for
/// known surfaces and a humanized fallback for anything outside the vocabulary.
function interactionCopy(id: InteractionId): InteractionCopy {
  return (
    INTERACTION_COPY[id] ?? {
      title: humanizeInteractionId(id),
      description: '',
    }
  )
}

export function InteractionList({
  interactions,
  t,
}: {
  /// The host surfaces the manifest declares, in manifest order.
  interactions: readonly InteractionId[]
  t: TFn
}) {
  if (interactions.length === 0) {
    return (
      <Text tone="subtle" as="small">
        {t('plugins.interactions.none')}
      </Text>
    )
  }

  return (
    <ul className="plugin-interaction-list">
      {interactions.map((interaction) => {
        const copy = interactionCopy(interaction)
        return (
          <li key={interaction} className="plugin-interaction-row">
            <Text as="span" className="plugin-interaction-row__title">
              {copy.title}
            </Text>
            {copy.description && (
              <Text as="small" tone="muted" className="plugin-interaction-row__description">
                {copy.description}
              </Text>
            )}
          </li>
        )
      })}
    </ul>
  )
}
