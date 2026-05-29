// Locale dictionaries the builtin Notes plugin contributes to the host.
//
// These strings used to live in the core `pt_BR.json` / `en_US.json` under the
// legacy Ideas key paths. The de-hardcoding moved them here: core no longer
// ships any Notes-specific strings, and `I18nProvider` overlays this
// contribution on top of the core JSON only while the Notes plugin is active.
// When the plugin is disabled, the overlay disappears and so do these keys —
// exactly the same lifecycle as every other Notes contribution.
//
// The plugin owns both the key definitions (here) and every lookup (the screen,
// list, editor, search and activation surfaces), so the key paths follow the
// Note/note rename end to end: `notes.*` for the feature strings, `shell.nav.notas`
// for the nav slot, `search.location.notes` for the search location. The archive
// label is keyed by the backend entity string (`archive_view.entity_label.note`,
// from `ArchivedItem.entidade === 'note'`) and the note search kind is the generic
// `search.kind.plugin` (notes register under the `plugin` search kind). Domain
// naming stays Portuguese where the host uses it (the nav slot id `notas`); only
// user-facing values read "notes". The plugin runs the host `t` against these
// overlaid keys.

import type { Dictionary, Locale } from '../../../i18n'

/// The Portuguese (pt-BR) overlay: the Notes feature's strings, mirroring the
/// core JSON shape so they deep-merge cleanly under the same key paths.
const ptBR: Dictionary = {
  shell: {
    nav: {
      notas: 'notas',
    },
  },
  search: {
    kind: {
      plugin: 'nota',
    },
    location: {
      notes: 'notas',
    },
  },
  archive_view: {
    entity_label: {
      note: 'nota',
    },
  },
  notes: {
    eyebrow: 'notas',
    aria_new: 'Nova nota',
    search_placeholder: 'buscar nota',
    list_empty: 'nenhuma nota',
    view_empty: 'nenhuma nota ainda',
    new_button: 'nova nota',
    loading_note: 'carregando nota...',
    label_color: 'Cor da nota',
    default_title: 'nova nota',
    fail_create: 'não foi possível criar a nota',
    archived: 'nota movida para Arquivo',
    fail_archive: 'não foi possível arquivar a nota',
    entity: 'esta nota',
  },
}

/// The English (en-US) overlay, same key paths as the pt-BR dictionary.
const enUS: Dictionary = {
  shell: {
    nav: {
      notas: 'notes',
    },
  },
  search: {
    kind: {
      plugin: 'note',
    },
    location: {
      notes: 'notes',
    },
  },
  archive_view: {
    entity_label: {
      note: 'note',
    },
  },
  notes: {
    eyebrow: 'notes',
    aria_new: 'New note',
    search_placeholder: 'search note',
    list_empty: 'no notes',
    view_empty: 'no notes yet',
    new_button: 'new note',
    loading_note: 'loading note...',
    label_color: 'Note color',
    default_title: 'new note',
    fail_create: 'could not create the note',
    archived: 'note moved to Archive',
    fail_archive: 'could not archive the note',
    entity: 'this note',
  },
}

/// Per-locale dictionaries, registered through `ctx.i18n.register` in `activate`.
/// The host overlays the active locale's dictionary on top of the core JSON.
export const NOTES_I18N: Partial<Record<Locale, Dictionary>> = {
  'pt-BR': ptBR,
  'en-US': enUS,
}
