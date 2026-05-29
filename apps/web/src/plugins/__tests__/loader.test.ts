import { describe, expect, it, vi } from 'vitest'

import {
  DirectModuleSandbox,
  IframeSandbox,
  externalEntryUrl,
  loadPluginModule,
  type LoadablePlugin,
  type PluginModule,
  type PluginSandbox,
} from '../runtime/loader'
import { builtinRegistry, isBuiltinPluginId } from '../runtime/builtinRegistry'
import { apiBase } from '../../lib/api'
import type { PluginManifest } from '../types/manifest'

// The builtin `notes` plugin pulls in the whole feature tree (React views, the
// Lexical editor, the notes API). The loader only needs the module's
// `activate`/`deactivate` surface, so we stub the import to a lightweight module:
// `DirectModuleSandbox.loadBuiltin('notes')` runs `builtinRegistry.notes()`,
// which is exactly `import('../builtin/notes')`, and we assert that resolves to a
// real `PluginModule` without dragging in the UI tree.
const builtinActivate = vi.fn()
const builtinDeactivate = vi.fn()
vi.mock('../builtin/notes', () => ({
  activate: builtinActivate,
  deactivate: builtinDeactivate,
}))

/// A minimal manifest; only the fields the loader reads (`id`, `version`,
/// `frontend_entry`, `source` via the row) matter here.
function manifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: 'notes',
    title: 'Notes',
    short_description: '',
    long_description: '',
    version: '1.0.0',
    author: '',
    publisher: '',
    homepage: '',
    repository: '',
    license: 'MIT',
    icon: '',
    screenshots: [],
    changelog: '',
    min_api_version: 7,
    api_version_range: { min: 7, max: 7 },
    frontend_entry: 'index.js',
    backend_entry: null,
    storage_schema_version: 1,
    migrations: [],
    extension_points: [],
    permissions: [],
    shortcuts: [],
    commands: [],
    interacts_with: [],
    conflicts: [],
    integrity: { package_sha256: '', manifest_sha256: '', algorithm: 'sha256' },
    signature: null,
    marketplace: { category: '', tags: [], verified: false, featured: false, downloads: 0, rating: 0 },
    ...overrides,
  }
}

describe('builtinRegistry', () => {
  it('names notes as a builtin with a lazy importer thunk', () => {
    expect(isBuiltinPluginId('notes')).toBe(true)
    expect(typeof builtinRegistry.notes).toBe('function')
  })

  it('does not treat an unknown id as a builtin', () => {
    expect(isBuiltinPluginId('definitely-not-a-builtin')).toBe(false)
  })
})

describe('DirectModuleSandbox', () => {
  it('resolves the notes builtin import to its activate surface', async () => {
    const sandbox = new DirectModuleSandbox()
    expect(sandbox.kind).toBe('direct-module')

    const raw = (await sandbox.loadBuiltin('notes')) as PluginModule
    expect(raw.activate).toBe(builtinActivate)
  })

  it('rejects an unknown builtin id without importing anything', async () => {
    const sandbox = new DirectModuleSandbox()
    await expect(sandbox.loadBuiltin('nope')).rejects.toThrow(/No builtin plugin registered/)
  })
})

describe('IframeSandbox', () => {
  it('is a documented stub that rejects until realm isolation lands', async () => {
    const sandbox = new IframeSandbox()
    expect(sandbox.kind).toBe('iframe')
    await expect(sandbox.loadBuiltin('notes')).rejects.toThrow(/not implemented/)
    await expect(sandbox.loadExternal('https://example.com/x.js')).rejects.toThrow(/not implemented/)
    // dispose is a no-op, not a throw.
    expect(() => sandbox.dispose('notes')).not.toThrow()
  })
})

describe('externalEntryUrl', () => {
  it('builds the backend-served ESM url from apiBase, id, version and entry', () => {
    const url = externalEntryUrl(manifest({ id: 'fancy', version: '2.3.4', frontend_entry: 'dist/entry.js' }))
    expect(url).toBe(`${apiBase}/api/plugins/fancy/2.3.4/dist/entry.js`)
  })

  it('encodes path segments but preserves separators in a nested entry', () => {
    const url = externalEntryUrl(manifest({ id: 'fancy', version: '1.0.0', frontend_entry: 'a b/c.js' }))
    expect(url).toBe(`${apiBase}/api/plugins/fancy/1.0.0/a%20b/c.js`)
  })
})

describe('loadPluginModule', () => {
  it('routes a builtin through sandbox.loadBuiltin(id), never loadExternal', async () => {
    const loadBuiltin = vi.fn(async () => ({ activate: vi.fn() }))
    const loadExternal = vi.fn(async () => ({ activate: vi.fn() }))
    const sandbox: PluginSandbox = { kind: 'direct-module', loadBuiltin, loadExternal }

    const installed: LoadablePlugin = { manifest: manifest({ id: 'notes' }), source: 'builtin' }
    const mod = await loadPluginModule(installed, sandbox)

    expect(loadBuiltin).toHaveBeenCalledWith('notes')
    expect(loadExternal).not.toHaveBeenCalled()
    expect(typeof mod.activate).toBe('function')
  })

  it('routes an external plugin through sandbox.loadExternal(url), never loadBuiltin', async () => {
    const loadBuiltin = vi.fn(async () => ({ activate: vi.fn() }))
    const loadExternal = vi.fn(async () => ({ activate: vi.fn() }))
    const sandbox: PluginSandbox = { kind: 'direct-module', loadBuiltin, loadExternal }

    const m = manifest({ id: 'ext', version: '9.0.0', frontend_entry: 'index.js' })
    await loadPluginModule({ manifest: m, source: 'url' }, sandbox)

    expect(loadExternal).toHaveBeenCalledWith(externalEntryUrl(m))
    expect(loadBuiltin).not.toHaveBeenCalled()
  })

  it('normalizes a default-export module that carries activate/deactivate', async () => {
    const activate = vi.fn()
    const deactivate = vi.fn()
    const sandbox: PluginSandbox = {
      kind: 'direct-module',
      loadBuiltin: async () => ({ default: { activate, deactivate } }),
      loadExternal: async () => ({}),
    }

    const mod = await loadPluginModule({ manifest: manifest(), source: 'builtin' }, sandbox)
    expect(mod.activate).toBe(activate)
    expect(mod.deactivate).toBe(deactivate)
  })

  it('throws a clear error when no activate() can be found', async () => {
    const sandbox: PluginSandbox = {
      kind: 'direct-module',
      loadBuiltin: async () => ({ notActivate: 1 }),
      loadExternal: async () => ({}),
    }
    await expect(loadPluginModule({ manifest: manifest({ id: 'broken' }), source: 'builtin' }, sandbox)).rejects.toThrow(
      /did not export an activate/,
    )
  })
})
