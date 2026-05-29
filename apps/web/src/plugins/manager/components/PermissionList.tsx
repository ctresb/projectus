// Presentational list of the permissions a plugin declares in its manifest.
//
// Each row is a single declared `PermissionId` rendered as a structured row: a
// bold, human title above a muted one-line description (never a raw bullet, never
// glued text). The optional toggle lets the user switch a permission off for the
// plugin (the conflict detector then blocks any contribution that needs it).
//
// The user-facing pt-BR copy lives in `PERMISSION_COPY` below so the wording is
// plain-language ("Ler notas" rather than the raw `notes:read` id). Unknown ids
// fall back to a humanized label with a generic description, so a plugin that
// declares a future permission still reads cleanly. Read-only when `onToggle`
// is omitted.

import { Checkbox, Text } from '../../../components/ui'
import type { PermissionId } from '../../types/permissions'
import type { TFn } from '../../../i18n'

/// A single permission's user-facing copy: a short title and a muted, plain
/// description. Kept here (not in the i18n dict) so the wording stays close to
/// the declared `PermissionId` and can be reviewed alongside the vocabulary.
type PermissionCopy = { title: string; description: string }

/// pt-BR copy for each declared permission. Every `PermissionId` maps to a
/// title + description pair; unknown ids are humanized at render time.
const PERMISSION_COPY: Record<PermissionId, PermissionCopy> = {
  'notes:read': {
    title: 'Ler notas',
    description: 'Lê as notas que você já tem no PROJECTUS.',
  },
  'notes:write': {
    title: 'Criar e editar notas',
    description: 'Cria notas novas e altera as que você já tem.',
  },
  'projects:read': {
    title: 'Ver seus projetos',
    description: 'Lê os projetos do PROJECTUS (não os altera).',
  },
  'tasks:read': {
    title: 'Ver suas tarefas',
    description: 'Lê as tarefas do PROJECTUS (não as altera).',
  },
  'screens:add': {
    title: 'Adicionar uma aba',
    description: 'Adiciona uma aba e uma tela próprias na navegação.',
  },
  'settings:add': {
    title: 'Adicionar ajustes',
    description: 'Inclui um painel próprio na tela de ajustes.',
  },
  'shortcuts:register': {
    title: 'Atalhos de teclado',
    description: 'Registra atalhos pelo gerenciador do app.',
  },
  'commands:register': {
    title: 'Comandos rápidos',
    description: 'Adiciona comandos à paleta (Cmd+K).',
  },
  'search:provide': {
    title: 'Aparecer na busca',
    description: 'Inclui resultados na busca global (Cmd+K).',
  },
  'editor:extend': {
    title: 'Estender o editor',
    description: 'Adiciona blocos e ações ao editor de texto.',
  },
  'archive:create': {
    title: 'Usar o Arquivo',
    description: 'Cria itens no Arquivo do PROJECTUS.',
  },
  attachments: {
    title: 'Anexos',
    description: 'Recebe imagens e arquivos anexados.',
  },
  events: {
    title: 'Acompanhar mudanças',
    description: 'Recebe avisos quando algo muda no app.',
  },
  network: {
    title: 'Acesso à internet',
    description: 'Faz conexões com serviços fora do app.',
  },
  'file:storage': {
    title: 'Armazenamento do plugin',
    description: 'Guarda dados próprios do plugin (não acessa seus arquivos no computador).',
  },
  secrets: {
    title: 'Guardar segredos',
    description: 'Armazena chaves e senhas de forma protegida.',
  },
  'background-jobs': {
    title: 'Tarefas em segundo plano',
    description: 'Agenda tarefas que rodam sozinhas de tempos em tempos.',
  },
}

/// Turn an unknown permission id (e.g. `some:new-thing`) into a readable title:
/// drop the scope separators, swap dashes for spaces, capitalize the first word.
function humanizePermissionId(id: string): string {
  const words = id.replace(/[:_-]+/g, ' ').trim()
  if (words.length === 0) return id
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/// Resolve the copy for a permission, falling back to a humanized title + a
/// generic description for ids not present in `PERMISSION_COPY`.
function permissionCopy(permission: PermissionId): PermissionCopy {
  return (
    PERMISSION_COPY[permission] ?? {
      title: humanizePermissionId(permission),
      description: 'Acesso adicional solicitado pelo plugin.',
    }
  )
}

export function PermissionList({
  permissions,
  disabled,
  onToggle,
  t,
}: {
  /// The permissions the manifest declares, in manifest order.
  permissions: readonly PermissionId[]
  /// Permissions the user has switched off for this plugin. Defaults to none.
  disabled?: readonly PermissionId[]
  /// Toggle handler; when omitted the list renders read-only (no checkboxes).
  onToggle?: (permission: PermissionId, enabled: boolean) => void
  t: TFn
}) {
  if (permissions.length === 0) {
    return (
      <Text tone="subtle" as="small">
        {t('plugins.permissions.none')}
      </Text>
    )
  }

  const off = new Set(disabled ?? [])

  return (
    <ul className="plugin-permission-list">
      {permissions.map((permission) => {
        const enabled = !off.has(permission)
        const { title, description } = permissionCopy(permission)
        const text = (
          <span className="plugin-permission-row__text">
            <Text as="span" className="plugin-permission-row__title">
              {title}
            </Text>
            <Text as="small" tone="muted" className="plugin-permission-row__description">
              {description}
            </Text>
          </span>
        )
        return (
          <li key={permission} className="plugin-permission-row">
            {onToggle ? (
              <Checkbox
                checked={enabled}
                onCheckedChange={(next) => onToggle(permission, next)}
                label={text}
              />
            ) : (
              text
            )}
          </li>
        )
      })}
    </ul>
  )
}
