// Presentational list of the keyboard shortcuts a plugin requests in its
// manifest (`manifest.shortcuts`). Each row shows the accelerator as keycaps
// alongside its description, so e.g. Notes' `mod+n` is always visible.
// Descriptions arrive already localized in the manifest, so no `t` is needed for
// them; the empty-state label and the reserved/delegated note are resolved by
// the caller's `t`.
//
// A shortcut whose accelerator matches one of PROJECTUS's own reserved
// accelerators (`NATIVE_SHORTCUT_KEYS`, e.g. `mod+n`/`mod+k`) is *delegated*, not
// a conflict: the host owns the accelerator and routes it to the active
// screen/plugin (this mirrors the `reserved-delegated` classification in
// `conflicts/detectConflicts`). Such a row gets a small muted note explaining
// the host owns it — the plugin may declare it but does not replace it.

import { Text } from '../../../components/ui'
import type { ManifestShortcut } from '../../types/manifest'
import type { TFn } from '../../../i18n'
import { NATIVE_SHORTCUT_KEYS } from '../../runtime/ShortcutManager'

/// Modifier tokens that all fold to the platform-agnostic `mod`. Matches the
/// fold list in `ShortcutManager.normalizeAccelerator` and
/// `conflicts/detectConflicts.normalizeAccelerator` so this component agrees with
/// the runtime and the detector on which accelerators are the host's reserved
/// ones.
const MOD_ALIASES = new Set(['mod', 'cmd', 'command', 'ctrl', 'control', 'meta'])

/// Canonicalize an accelerator so `Mod+Shift+N`, `shift+mod+n`, and
/// `mod+shift+n` all compare equal: lowercase, split on `+`, fold modifier
/// aliases to `mod`, sort the modifiers, keep the final key last. Returns `''`
/// for an empty accelerator. Mirrors the runtime/detector convention.
function normalizeAccelerator(raw: string): string {
  const parts = raw
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => (MOD_ALIASES.has(part) ? 'mod' : part))
  if (parts.length === 0) return ''
  const key = parts[parts.length - 1]
  const mods = parts.slice(0, -1).sort()
  return [...mods, key].join('+')
}

/// The host's reserved accelerators, normalized once. A declared shortcut whose
/// normalized accelerator is in here is delegated to the host.
const RESERVED_ACCELERATORS = new Set(
  NATIVE_SHORTCUT_KEYS.map((key) => normalizeAccelerator(key)).filter((key) => key.length > 0),
)

/// Split an accelerator into its display tokens (in declaration order, trimmed of
/// empties) so each renders as its own keycap, e.g. `mod+shift+n` → `['mod',
/// 'shift', 'n']`. The raw accelerator string is kept verbatim by the caller for
/// the keycap title.
function acceleratorTokens(keys: string): string[] {
  return keys
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

export function ShortcutList({
  shortcuts,
  t,
}: {
  /// The shortcuts the manifest declares, in manifest order.
  shortcuts: readonly ManifestShortcut[]
  t: TFn
}) {
  if (shortcuts.length === 0) {
    return (
      <Text tone="subtle" as="small">
        {t('plugins.shortcuts.none')}
      </Text>
    )
  }

  return (
    <ul className="plugin-shortcut-list">
      {shortcuts.map((shortcut) => {
        const reserved = RESERVED_ACCELERATORS.has(normalizeAccelerator(shortcut.keys))
        return (
          <li key={shortcut.id} className="plugin-shortcut-list__item">
            <kbd className="plugin-shortcut-list__keys" title={shortcut.keys}>
              {acceleratorTokens(shortcut.keys).map((token, index) => (
                <kbd key={`${token}:${index}`} className="plugin-shortcut-list__keycap">
                  {token}
                </kbd>
              ))}
            </kbd>
            <span className="plugin-shortcut-list__body">
              <Text as="span" className="plugin-shortcut-list__title">
                {shortcut.description}
              </Text>
              {reserved && (
                <Text as="small" tone="subtle" className="plugin-shortcut-list__reserved">
                  {t('plugins.shortcuts.reserved')}
                </Text>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
