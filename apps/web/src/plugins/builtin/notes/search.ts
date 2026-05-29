// Global-search contribution for the builtin Notes plugin.
//
// Builds `GlobalSearchEntry` rows from a notes index and declares the scope
// aliases (`note`/`notas`) and color the host merges into its `SCOPE_ALIASES` /
// `SCOPE_KIND_COLORS` maps. Entries reuse the host `GlobalSearchEntry` shape so
// they fold into the same ranked index the core builder produces — core stays
// plugin-agnostic and never names "notes".
//
// Domain fields stay Portuguese (`titulo`, `cor`, `pasta`, `atualizado_em`); only
// the feature naming is Note/note. Each entry's action carries the plugin routing
// intent (`{ pluginId, screen, focus }`) so the host can open the Notes screen
// focused on the right note.

import type { TFn } from '../../../i18n'
import { normalizeSingleValue } from '../../../features/search/searchIndex'
import type { GlobalSearchEntry, GlobalSearchKind, SearchNavigationTarget } from '../../../features/search/types'
import type { NoteCard } from './notesApi'

/// The plugin's own screen route id (matches the manifest screen + nav item).
export const NOTES_SCREEN = 'notes'

/// The search kind notes register under. The host treats every plugin-owned hit
/// as the generic `plugin` kind (the scope aliases below widen `note`/`notas`
/// onto it), keeping the shared index a single closed `GlobalSearchKind` union
/// that core never has to extend per plugin.
export const NOTE_SEARCH_KIND: GlobalSearchKind = 'plugin'

/// Accent color for note search results and the `note`/`notas` scope chips.
export const NOTE_SEARCH_COLOR = '#FAD344'

/// Scope aliases the host merges into its `SCOPE_ALIASES` map, so typing
/// `note/`, `notes/`, `nota/` or `notas/` in global search filters to notes.
export const NOTE_SCOPE_ALIASES: Record<string, GlobalSearchKind[]> = {
  note: [NOTE_SEARCH_KIND],
  notes: [NOTE_SEARCH_KIND],
  nota: [NOTE_SEARCH_KIND],
  notas: [NOTE_SEARCH_KIND],
}

/// Kind colors the host merges into its `SCOPE_KIND_COLORS` map.
export const NOTE_SCOPE_COLORS: Partial<Record<GlobalSearchKind, string>> = {
  [NOTE_SEARCH_KIND]: NOTE_SEARCH_COLOR,
}

/// The owning plugin id (matches the manifest `id`).
export const NOTES_PLUGIN_ID = 'notes'

/// Build the navigation target for a note hit. Encodes the generic plugin route
/// `{ type: 'plugin', pluginId, screen, focus }` the host's plugin-aware router
/// consumes: it opens this plugin's screen and forwards `focus` (the note id) as
/// the screen's `navigationRequest`. Core stays plugin-agnostic — it never names
/// "notes", it just routes whatever plugin/screen/focus the hit carries.
export function noteSearchTarget(id: string): SearchNavigationTarget {
  return { type: 'plugin', pluginId: NOTES_PLUGIN_ID, screen: NOTES_SCREEN, focus: id }
}

/// Build global-search entries from a notes index. Mirrors the layout the core
/// builder used for the inline notes loop (title + folder + localized kind/location
/// in the search/scope text), so ranking is identical for notes and core kinds.
export function buildNoteSearchEntries(notes: NoteCard[], t: TFn): GlobalSearchEntry[] {
  const kindLabel = t('search.kind.plugin')
  const locationLabel = t('search.location.notes')
  return notes.map((note) => ({
    id: `note:${note.id}`,
    kind: NOTE_SEARCH_KIND,
    title: note.titulo,
    location: locationLabel,
    color: note.cor,
    updatedAt: note.atualizado_em,
    searchText: normalizeText([note.titulo, note.pasta, kindLabel, locationLabel]),
    scopeText: normalizeText([kindLabel, locationLabel, note.titulo, note.pasta]),
    action: noteSearchTarget(note.id),
  }))
}

function normalizeText(values: Array<string | null | undefined>): string {
  return normalizeSingleValue(values.filter(Boolean).join(' '))
}
