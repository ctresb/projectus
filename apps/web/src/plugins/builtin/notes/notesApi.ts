// Note CRUD client for the builtin Notes plugin.
//
// The Rust backend (crates/server) is the only durable writer; this module just
// speaks to its `/notes` endpoints. It reuses the host's `apiRequest`/`apiBase`
// from `lib/api.ts` (the `/api`-prefixed fetch wrapper that throws `ApiFailure`
// on non-2xx) instead of re-implementing transport, so plugin and core share one
// HTTP path. The note CRUD helpers previously lived on the core `api` object and
// were removed from `lib/api.ts`; they now live here, scoped to the plugin.
//
// Domain fields stay Portuguese to match the rest of the codebase
// (`titulo`, `cor`, `pasta`, `criado_em`, `atualizado_em`, `revision`, `notas`).

import { apiBase, apiRequest } from '../../../lib/api'
import type { DocumentResponse, Note, NotesIndex } from '../../../lib/types'

/// A single note card and the note collection. These reuse the host domain types
/// (Portuguese fields preserved); only the feature-level naming is Note/note.
export type NoteCard = Note
export type NoteCollection = NotesIndex

/// Note CRUD over the backend `/notes` endpoints, mirroring the old core idea
/// helpers one-to-one (now plugin-owned).
export const notesApi = {
  /// Fetch one note document (card metadata + markdown body).
  note: (id: string) => apiRequest<DocumentResponse<NoteCard>>(`/notes/${id}`),
  /// Create a note from a title and markdown body.
  createNote: (input: { titulo: string; markdown: string }) =>
    apiRequest<DocumentResponse<NoteCard>>('/notes', { method: 'POST', body: JSON.stringify(input) }),
  /// Update a note; `revision` guards against lost updates.
  updateNote: (id: string, input: { revision: number; titulo: string; markdown: string; cor: string }) =>
    apiRequest<DocumentResponse<NoteCard>>(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  /// Archive a note, returning the refreshed note collection.
  archiveNote: (id: string, revision: number) =>
    apiRequest<NoteCollection>(`/notes/${id}?revision=${revision}`, { method: 'DELETE' }),
  /// List every note (collection + revision).
  notes: () => apiRequest<NoteCollection>('/notes'),
  /// Absolute base URL for the backend, e.g. to build attachment image URLs.
  base: apiBase,
}
