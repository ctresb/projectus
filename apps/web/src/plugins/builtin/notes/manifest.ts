// The builtin Notes plugin manifest.
//
// This is the TypeScript `PluginManifest` (mirroring the Rust authority) that the
// host validates and loads `plugins/builtin/notes/` from. It declares everything
// the Notes feature contributes — a routed screen + side-nav entry, a global
// search provider, an archive integration, the markdown editor and file storage
// it touches, and the `mod+n` quick-create shortcut — so the host's conflict
// detector and permission gate can reason about the plugin without running it.
//
// Notes is a *builtin*: it ships inside the host bundle, so it is trusted at the
// module boundary. The integrity block still carries the mandatory SHA-256
// algorithm marker (never MD5); the concrete digests are computed by the backend
// over the served package and are empty here for the in-bundle builtin. The
// signature block is `null` — a builtin has no marketplace publisher signature;
// its trust comes from being part of the host build.
//
// Domain naming: the manifest contract is the marketplace-facing surface, so its
// own field names stay English. The host's PROJECTUS domain identifiers
// (`titulo`, `cor`, `notas`, `revision`, …) are untouched elsewhere. The feature
// itself is the renamed Ideas → Notes builtin; its `storage_schema_version`
// migration records that rename (the old `ideias` store becomes `notes`).

import type { PluginManifest } from '../../types/manifest'

export const manifest: PluginManifest = {
  id: 'notes',
  title: 'Notes',
  short_description: 'Quick markdown notes with global search and archive.',
  long_description:
    'Notes is the builtin note-taking surface for PROJECTUS: a markdown editor, ' +
    'instant quick-create, color-coded note cards, global-search integration and ' +
    'archive/restore. It is the Ideas feature, promoted to a first-class plugin.',
  version: '1.0.0',
  author: 'PROJECTUS',
  publisher: 'PROJECTUS',
  homepage: '',
  repository: '',
  license: 'MIT',
  // Lucide icon name; the nav contribution renders the matching component.
  icon: 'Lightbulb',
  screenshots: [],
  changelog: '',
  // Builtins target the host build they ship with.
  min_api_version: 7,
  api_version_range: { min: 7, max: 7 },
  // The ESM entry the host imports. For a builtin this is resolved through
  // `builtinRegistry` (`import('../builtin/notes')`), not fetched over HTTP.
  frontend_entry: 'index.ts',
  backend_entry: null,
  storage_schema_version: 1,
  // The Ideas → Notes rename: the old `ideias` store migrates to `notes`.
  migrations: [{ from: 1, to: 1, description: 'Rename the ideias store to notes.' }],
  // Extension points this plugin contributes to (host vocabulary, validated by
  // the backend). Matches the contributions `activate` registers.
  extension_points: ['navItem', 'screen', 'searchProvider', 'archiveIntegration', 'shortcut'],
  permissions: [
    'notes:read',
    'notes:write',
    'screens:add',
    'shortcuts:register',
    'archive:create',
    'attachments',
  ],
  shortcuts: [
    {
      id: 'quick-create',
      keys: 'mod+n',
      description: 'Create a new note',
    },
  ],
  commands: [],
  interacts_with: ['MARKDOWN_EDITOR', 'SIDE_NAVIGATION', 'GLOBAL_SEARCH', 'ARCHIVE', 'FILE_STORAGE'],
  conflicts: [],
  // SHA-256 is the mandatory integrity algorithm (never MD5). The digests are
  // computed by the backend over the served package; a bundled builtin is
  // verified by being part of the host build, so the digests are empty here.
  integrity: {
    package_sha256: '',
    manifest_sha256: '',
    algorithm: 'sha256',
  },
  // No marketplace publisher signature: a builtin's trust is the host build.
  signature: null,
  marketplace: {
    category: 'productivity',
    tags: ['notes', 'markdown', 'productivity'],
    verified: true,
    featured: true,
    downloads: 0,
    rating: 0,
  },
}

export default manifest
