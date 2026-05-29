// Activation entry for the builtin Notes plugin.
//
// This is the module `builtinRegistry` imports (`import('../builtin/notes')`).
// `activate(ctx)` registers everything the Notes feature contributes through the
// host's scoped `PluginContext` — a side-nav entry, a routed screen rendering
// `NotesView`, a global-search provider, an archive integration and the `mod+n`
// quick-create shortcut. `deactivate()` drops the plugin's local runtime state;
// the registry/shortcut contributions themselves are torn down by the host's
// `unregisterPlugin(id)` / `ShortcutManager.unregisterPlugin(id)` (scoped by the
// `pluginId` the runtime stamped on each contribution), so nothing here has to
// undo individual registrations.
//
// Core stays plugin-agnostic: this file is the *plugin* side of the contract, so
// naming the host surfaces (nav, screen, search, archive, shortcuts) here is
// correct — it is the host's core files that must never name a plugin, not the
// reverse. Domain fields stay Portuguese (`notas`, `revision`, `titulo`, `cor`);
// only the feature naming is Note/note.

import { createElement, useCallback, useEffect, useRef } from 'react'
import { Lightbulb } from 'lucide-react'

import type { PluginContext } from '../../runtime/PluginContext'
import type { ScreenRenderProps } from '../../types/extension-points'
import { DEFAULT_LOCALE, LOCALES, type Dictionary, type Locale, type TFn } from '../../../i18n'
import { api } from '../../../lib/api'
import type { NotesIndex } from '../../../lib/types'
import { useWorkspace } from '../../../hooks/useWorkspace'

import { NotesView, type NotesViewHandle } from './NotesView'
import { notesApi } from './notesApi'
import { NOTES_PLUGIN_ID, NOTES_SCREEN, NOTE_SCOPE_ALIASES, NOTE_SCOPE_COLORS, buildNoteSearchEntries } from './search'
import { NOTES_I18N } from './i18n'

import { manifest } from './manifest'

export { manifest }

// --- Standalone i18n -------------------------------------------------------
//
// `activate(ctx)` runs outside any React render, so the `useT` hook is not
// available for the labels resolved at registration time (the nav entry, the
// archive entity label). Resolve them against the locale dictionaries directly,
// mirroring `I18nProvider`'s resolver. The search provider instead localizes with
// the live host `t` the index passes in its `SearchProviderContext`.

/// Resolve a dotted key against a dictionary, exactly as `I18nProvider` does.
function resolveKey(dict: Dictionary, key: string): string | undefined {
  const parts = key.split('.')
  let cur: string | Dictionary = dict
  for (const part of parts) {
    if (typeof cur === 'string') return undefined
    const next: string | Dictionary | undefined = cur[part]
    if (next === undefined) return undefined
    cur = next
  }
  return typeof cur === 'string' ? cur : undefined
}

/// Deep-merge `overlay` onto `base`, overlay leaves winning. Mirrors the host
/// `I18nProvider` merge so the activation-time translator sees the same overlaid
/// dictionary the React surfaces do — necessary because the Notes strings the
/// nav/archive labels read (`shell.nav.notas`, `archive_view.entity_label.note`)
/// now live in this plugin's i18n contribution, not in the core JSON.
function mergeDictionaries(base: Dictionary, overlay: Dictionary): Dictionary {
  const out: Dictionary = { ...base }
  for (const [key, value] of Object.entries(overlay)) {
    const existing = out[key]
    if (
      typeof existing === 'object' &&
      existing !== null &&
      typeof value === 'object' &&
      value !== null
    ) {
      out[key] = mergeDictionaries(existing, value)
    } else {
      out[key] = value
    }
  }
  return out
}

/// A non-React `t` bound to a locale, used only for activation-time labels. The
/// core dict is overlaid with this plugin's `NOTES_I18N` for the locale so the
/// Notes-owned keys resolve even though core no longer ships them.
function staticTranslator(locale: Locale): TFn {
  const base = LOCALES[locale]?.dict ?? LOCALES[DEFAULT_LOCALE].dict
  const overlay = NOTES_I18N[locale] ?? NOTES_I18N[DEFAULT_LOCALE]
  const dict = overlay ? mergeDictionaries(base, overlay) : base
  return (key) => resolveKey(dict, key) ?? key
}

// --- Plugin-local runtime state --------------------------------------------
//
// One bit of state bridges a React surface to a non-React contribution callback
// the host invokes later: `viewHandle`, the imperative `NotesView` handle, so the
// `mod+n` shortcut can drive quick-create without the view attaching its own
// keydown listener. Search no longer reads any module global — the host hands the
// provider the live `{ workspace, t }` at index time (see `addSearchProvider`),
// so notes are indexed whether or not the Notes screen has ever mounted.

/// The live `NotesView` handle, set while the Notes screen is mounted.
const viewHandle: { current: NotesViewHandle | null } = { current: null }

// --- The routed screen -----------------------------------------------------
//
// The host renders this for the `notes` screen id, passing the small
// `ScreenRenderProps` (a `SearchNavigationTarget` + a string-only `onMessage`).
// The richer data `NotesView` needs (`config`, the notes collection, the
// `onNotes` writer) is sourced from the same `useWorkspace` hook the host uses,
// so the plugin is self-contained and reads/writes the one backend.

function NotesScreen({ navigationRequest, onMessage }: ScreenRenderProps) {
  const { workspace, setWorkspace } = useWorkspace()
  const ref = useRef<NotesViewHandle>(null)

  // Expose the handle to the `mod+n` shortcut for as long as the screen is up.
  useEffect(() => {
    viewHandle.current = ref.current
    return () => {
      viewHandle.current = null
    }
  })

  const notes = workspace?.notes ?? { revision: 0, notas: [] }

  const onNotes = useCallback(
    (next: NotesIndex) => {
      setWorkspace((current) => (current ? { ...current, notes: next } : current))
    },
    [setWorkspace],
  )

  // Bridge the host's transient-message channel (string only) to NotesView's
  // typed `(type, text)` callback; the host surfaces the text.
  const handleMessage = useCallback(
    (_type: 'ok' | 'erro', text: string) => {
      onMessage(text)
    },
    [onMessage],
  )

  // Adapt the host's `SearchNavigationTarget` to NotesView's `{ id, token }`
  // request: a note hit rides the generic plugin target `{ type: 'plugin',
  // pluginId, screen, focus }` (see `search.ts`). Guard on this plugin's id so a
  // different plugin's screen request is ignored; `focus` carries the note id.
  const navReq =
    navigationRequest &&
    navigationRequest.type === 'plugin' &&
    navigationRequest.pluginId === NOTES_PLUGIN_ID &&
    navigationRequest.focus
      ? { id: navigationRequest.focus, token: navTokenFor(navigationRequest.focus) }
      : null

  if (!workspace) return null

  return createElement(NotesView, {
    ref,
    config: workspace.config,
    notes,
    navigationRequest: navReq,
    onNotes,
    onMessage: handleMessage,
  })
}

/// `NotesView` re-runs its navigation effect only when the request `token`
/// changes, so derive a stable-per-id token: a new id yields a new token, the
/// same id keeps the same one. Module-scoped so it survives re-renders.
const navTokens = new Map<string, number>()
let navTokenSeq = 0
function navTokenFor(id: string): number {
  const existing = navTokens.get(id)
  if (existing !== undefined) return existing
  navTokenSeq += 1
  navTokens.set(id, navTokenSeq)
  return navTokenSeq
}

// --- Activation ------------------------------------------------------------

/// Wire the Notes plugin into the host. Every registration is permission-gated
/// by the manifest the host built the context from, and stamped with the
/// `notes` plugin id so `deactivate` (host-driven `unregisterPlugin`) is clean.
export function activate(ctx: PluginContext): void {
  const t = staticTranslator(resolveLocale(ctx))

  // Locale dictionaries the host overlays on top of the core JSON while Notes is
  // active. These carry every Notes-owned string (`notes.*`, the `notas` nav
  // label, the `note` search location, the `note` archive entity label) that core
  // no longer ships, so the screen/search surfaces resolve them through the host
  // `t`. Registered first so the overlay is in place for the rest.
  ctx.i18n.register({ id: 'i18n', dictionaries: NOTES_I18N })

  // Side-navigation entry → the `notes` screen. Label resolved now (the nav
  // label is static for the activation's lifetime); icon is the Lucide Lightbulb
  // the manifest names.
  ctx.contributes.addNavItem({
    id: 'nav',
    label: t('shell.nav.notas'),
    icon: Lightbulb,
    screen: NOTES_SCREEN,
  })

  // The routed screen rendering `NotesView`.
  ctx.contributes.addScreen({
    id: NOTES_SCREEN,
    render: (props) => createElement(NotesScreen, props),
  })

  // Global-search provider: entries built from the live workspace the host hands
  // in (`{ workspace, t }`), so notes are indexed whether or not the Notes screen
  // has ever mounted. Plus the `note`/`notas` scope aliases and accent color the
  // host merges into its search maps.
  ctx.contributes.addSearchProvider({
    id: 'search',
    entries: ({ workspace, t: tt }) => buildNoteSearchEntries(workspace.notes.notas, tt),
    scopeAliases: NOTE_SCOPE_ALIASES,
    colors: NOTE_SCOPE_COLORS,
  })

  // Archive integration: how an archived note appears in / restores from the
  // host archive. The backend tags archived notes with the `note` entity.
  ctx.contributes.addArchiveIntegration({
    id: 'archive',
    entityType: 'note',
    entityLabel: t('archive_view.entity_label.note'),
    restore: async (archiveId) => {
      // Restore against the latest notes revision (the destination collection).
      const collection = await notesApi.notes()
      const index = await api.archive()
      await api.restoreArchived(archiveId, index.revision, collection.revision)
    },
  })

  // Quick-create shortcut. Routed through the host shortcut manager (the single
  // sanctioned keydown owner) instead of an in-component `window` listener: the
  // handler drives the imperative `NotesView` handle. NOTE: `mod+n` is a host
  // reserved accelerator, so the manager may decline to bind it (the host owns
  // "new"); registering through `ctx.shortcuts` is still the correct, declared
  // path and lets the host arbitrate the collision.
  ctx.shortcuts.register({
    id: 'quick-create',
    keys: 'mod+n',
    description: t('notes.new_button'),
    run: () => {
      viewHandle.current?.quickCreate()
    },
  })
}

/// Resolve the active locale for activation-time labels. The plugin context does
/// not carry the user's locale, so fall back to the host default; the screen and
/// search surfaces re-localize live through `useT`.
function resolveLocale(_ctx: PluginContext): Locale {
  return DEFAULT_LOCALE
}

/// Drop plugin-local runtime state. The host unregisters this plugin's
/// contributions (registry) and shortcut bindings by `pluginId` separately, so
/// `deactivate` only has to release the references this module holds.
export function deactivate(): void {
  viewHandle.current = null
  navTokens.clear()
  navTokenSeq = 0
}
