import { describe, expect, it } from 'vitest'

import {
  detectConflicts,
  NATIVE_OWNER,
  type ConflictDetectionInput,
  type InstalledPluginInput,
  type NativeBaseline,
  type PluginConflict,
  type PluginConflictKind,
} from '../conflicts/detectConflicts'
import type { PluginManifest } from '../types/manifest'
import type {
  ShortcutContribution,
  NavItemContribution,
  ScreenContribution,
} from '../types/extension-points'

// --- Builders --------------------------------------------------------------

function manifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: 'plugin-a',
    title: 'Plugin A',
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
    integrity: { package_sha256: 'aa', manifest_sha256: 'bb', algorithm: 'sha256' },
    signature: null,
    marketplace: { category: '', tags: [], verified: false, featured: false, downloads: 0, rating: 0 },
    ...overrides,
  }
}

function plugin(overrides: Partial<InstalledPluginInput> & { manifest: PluginManifest }): InstalledPluginInput {
  return {
    state: 'enabled',
    source: 'zip',
    trust: 'verified',
    ...overrides,
  }
}

function shortcut(pluginId: string, keys: string): ShortcutContribution {
  return { pluginId, id: `${pluginId}-sc`, keys, run: () => undefined }
}

function navItem(pluginId: string, screen: string): NavItemContribution {
  return {
    pluginId,
    id: `${pluginId}-nav`,
    label: pluginId,
    icon: () => null,
    screen,
  }
}

function screenContribution(pluginId: string, id: string): ScreenContribution {
  return { pluginId, id, render: () => null }
}

const baseNative: NativeBaseline = {
  shortcutKeys: ['mod+k', 'mod+n'],
  screenIds: ['projetos', 'config'],
  editorNodeNames: [],
  toolbarSlots: [],
  apiVersion: 7,
}

function run(input: Partial<ConflictDetectionInput> & { plugins: readonly InstalledPluginInput[] }): PluginConflict[] {
  return detectConflicts({
    contributions: [],
    native: baseNative,
    ...input,
  })
}

function kinds(conflicts: PluginConflict[]): PluginConflictKind[] {
  return conflicts.map((c) => c.kind)
}

// --- Tests -----------------------------------------------------------------

describe('detectConflicts: shortcut collisions', () => {
  it('reports two plugins binding the same accelerator (case/order-insensitive)', () => {
    const conflicts = run({
      plugins: [plugin({ manifest: manifest({ id: 'a' }) }), plugin({ manifest: manifest({ id: 'b' }) })],
      contributions: [shortcut('a', 'mod+shift+n'), shortcut('b', 'Shift+Mod+N')],
    })

    const dup = conflicts.filter((c) => c.kind === 'duplicate-shortcut')
    expect(dup).toHaveLength(1)
    // First claimant ('a') wins; the later one ('b') is reported as the loser.
    expect(dup[0]).toMatchObject({ pluginId: 'b', otherId: 'a', severity: 'warning' })
  })

  it('reports a plugin declaring a native accelerator as reserved-delegated (info, non-fatal)', () => {
    const conflicts = run({
      plugins: [plugin({ manifest: manifest({ id: 'a' }) })],
      contributions: [shortcut('a', 'mod+k')],
    })

    // A plugin declaring a host-RESERVED accelerator is NOT a hard conflict: the
    // accelerator belongs to PROJECTUS and is delegated to the active
    // screen/plugin, so it is reported as an informational `reserved-delegated`
    // row (not a `native-supersede` warning and not a `duplicate-shortcut`).
    expect(kinds(conflicts)).not.toContain('native-supersede')
    expect(kinds(conflicts)).not.toContain('duplicate-shortcut')
    const delegated = conflicts.filter((c) => c.kind === 'reserved-delegated')
    expect(delegated).toHaveLength(1)
    expect(delegated[0]).toMatchObject({
      pluginId: 'a',
      otherId: NATIVE_OWNER,
      severity: 'info',
      detail: 'shortcut "mod+k"',
      reservedKey: 'mod+k',
    })
  })

  it('treats mod+n (a native-reserved accelerator) as reserved-delegated, not a conflict', () => {
    // Mirrors the bundled Notes plugin, which declares `mod+n`: it must still be
    // reported (so the UI shows it) but never as a fatal/warning conflict.
    const conflicts = run({
      plugins: [plugin({ manifest: manifest({ id: 'notes' }), source: 'builtin', trust: 'builtin' })],
      contributions: [shortcut('notes', 'mod+n')],
    })

    expect(kinds(conflicts)).not.toContain('native-supersede')
    expect(kinds(conflicts)).not.toContain('duplicate-shortcut')
    const delegated = conflicts.filter((c) => c.kind === 'reserved-delegated')
    expect(delegated).toHaveLength(1)
    expect(delegated[0]).toMatchObject({
      pluginId: 'notes',
      severity: 'info',
      reservedKey: 'mod+n',
    })
  })

  it('does not report distinct accelerators', () => {
    const conflicts = run({
      plugins: [plugin({ manifest: manifest({ id: 'a' }) }), plugin({ manifest: manifest({ id: 'b' }) })],
      contributions: [shortcut('a', 'mod+shift+1'), shortcut('b', 'mod+shift+2')],
    })
    expect(kinds(conflicts)).not.toContain('duplicate-shortcut')
  })
})

describe('detectConflicts: route/screen collisions', () => {
  it('reports two plugins claiming the same screen id', () => {
    const conflicts = run({
      plugins: [plugin({ manifest: manifest({ id: 'a' }) }), plugin({ manifest: manifest({ id: 'b' }) })],
      contributions: [screenContribution('a', 'dashboard'), screenContribution('b', 'dashboard')],
    })

    const dup = conflicts.filter((c) => c.kind === 'duplicate-screen')
    expect(dup).toHaveLength(1)
    expect(dup[0]).toMatchObject({ pluginId: 'b', otherId: 'a', detail: 'screen "dashboard"' })
  })

  it('reports a nav item pointing at a native screen route as superseded by the host', () => {
    const conflicts = run({
      plugins: [plugin({ manifest: manifest({ id: 'a' }) })],
      contributions: [navItem('a', 'config')],
    })

    // A native screen id is host-owned, so an external nav route onto it is a
    // native-supersede rather than a plugin/plugin duplicate.
    const superseded = conflicts.filter((c) => c.kind === 'native-supersede')
    expect(superseded).toHaveLength(1)
    expect(superseded[0]).toMatchObject({ pluginId: 'a', otherId: NATIVE_OWNER, detail: 'screen "config"' })
  })

  it('reports an external screen superseded by a builtin claiming the same id', () => {
    const conflicts = run({
      plugins: [
        plugin({ manifest: manifest({ id: 'builtin-x' }), source: 'builtin' }),
        plugin({ manifest: manifest({ id: 'ext-x' }), source: 'zip' }),
      ],
      // Order matters: the builtin claims first, so the external one is superseded.
      contributions: [screenContribution('builtin-x', 'notes'), screenContribution('ext-x', 'notes')],
    })

    const superseded = conflicts.filter((c) => c.kind === 'native-supersede')
    expect(superseded).toHaveLength(1)
    expect(superseded[0]).toMatchObject({ pluginId: 'ext-x', otherId: NATIVE_OWNER })
  })

  it('does not flag a plugin claiming its OWN screen id via both a screen and a nav item', () => {
    // The bundled Notes plugin contributes BOTH `addScreen({ id: 'notes' })` and
    // `addNavItem({ screen: 'notes' })`. Both point at the same `notes` route
    // owned by the SAME plugin, so it is self — never a duplicate-screen.
    const conflicts = run({
      plugins: [plugin({ manifest: manifest({ id: 'notes' }), source: 'builtin', trust: 'builtin' })],
      contributions: [screenContribution('notes', 'notes'), navItem('notes', 'notes')],
    })

    expect(kinds(conflicts)).not.toContain('duplicate-screen')
    expect(kinds(conflicts)).not.toContain('native-supersede')
    expect(conflicts).toEqual([])
  })

  it('does not treat a plugin screen id as native (notes is never a native route)', () => {
    // The host baseline lists ONLY true native screens; `notes` is a plugin
    // route, so the builtin's own `notes` screen is not a native-supersede.
    const conflicts = detectConflicts({
      plugins: [plugin({ manifest: manifest({ id: 'notes' }), source: 'builtin', trust: 'builtin' })],
      contributions: [screenContribution('notes', 'notes')],
      native: {
        shortcutKeys: ['mod+k', 'mod+n'],
        screenIds: ['projetos', 'arquivo', 'backup', 'config', 'plugins'],
        editorNodeNames: [],
        toolbarSlots: [],
        apiVersion: 7,
      },
    })
    expect(conflicts).toEqual([])
  })
})

describe('detectConflicts: api version too new', () => {
  it('reports a plugin whose minimum API version exceeds the host build', () => {
    const conflicts = run({
      plugins: [
        plugin({ manifest: manifest({ id: 'future', api_version_range: { min: 9, max: 9 }, min_api_version: 9 }) }),
      ],
    })

    const tooNew = conflicts.filter((c) => c.kind === 'api-version-too-new')
    expect(tooNew).toHaveLength(1)
    expect(tooNew[0]).toMatchObject({ pluginId: 'future', severity: 'fatal' })
    expect(tooNew[0].detail).toContain('9')
  })

  it('does not report a plugin whose API range covers the host version', () => {
    const conflicts = run({
      plugins: [plugin({ manifest: manifest({ id: 'ok', api_version_range: { min: 7, max: 7 } }) })],
    })
    expect(kinds(conflicts)).not.toContain('api-version-too-new')
  })
})

describe('detectConflicts: permission disabled by the user', () => {
  it('reports a contribution needing a permission the user switched off', () => {
    const conflicts = run({
      plugins: [plugin({ manifest: manifest({ id: 'a' }) })],
      contributions: [shortcut('a', 'mod+shift+j')],
      disabledPermissions: { a: ['shortcuts:register'] },
    })

    const denied = conflicts.filter((c) => c.kind === 'permission-disabled')
    expect(denied).toHaveLength(1)
    expect(denied[0]).toMatchObject({ pluginId: 'a', detail: 'shortcuts:register', severity: 'fatal' })
  })

  it('does not report when the disabled permission is unrelated to the contribution', () => {
    const conflicts = run({
      plugins: [plugin({ manifest: manifest({ id: 'a' }) })],
      contributions: [shortcut('a', 'mod+shift+j')],
      disabledPermissions: { a: ['network'] },
    })
    expect(kinds(conflicts)).not.toContain('permission-disabled')
  })
})

describe('detectConflicts: integrity mismatch and declared conflicts (fatal)', () => {
  it('reports a backend integrity mismatch as fatal', () => {
    const conflicts = run({
      plugins: [plugin({ manifest: manifest({ id: 'bad' }), trust: 'mismatch' })],
    })
    const mismatch = conflicts.filter((c) => c.kind === 'integrity-mismatch')
    expect(mismatch).toHaveLength(1)
    expect(mismatch[0]).toMatchObject({ pluginId: 'bad', severity: 'fatal' })
  })

  it('never reports a builtin-trust plugin as an integrity mismatch', () => {
    // A first-party (`trust: 'builtin'`) plugin is implicitly trusted; it must
    // never surface as a fatal integrity conflict, so a bundled plugin does not
    // look like an unsafe external package.
    const conflicts = run({
      plugins: [plugin({ manifest: manifest({ id: 'notes' }), source: 'builtin', trust: 'builtin' })],
    })
    expect(kinds(conflicts)).not.toContain('integrity-mismatch')
    expect(conflicts).toEqual([])
  })

  it('reports a manifest-declared conflict when the named plugin is also installed', () => {
    const conflicts = run({
      plugins: [
        plugin({ manifest: manifest({ id: 'a', conflicts: ['b'] }) }),
        plugin({ manifest: manifest({ id: 'b' }) }),
      ],
    })
    const declared = conflicts.filter((c) => c.kind === 'declared-conflict')
    expect(declared).toHaveLength(1)
    expect(declared[0]).toMatchObject({ pluginId: 'a', otherId: 'b', severity: 'fatal' })
  })
})

describe('detectConflicts: clean input', () => {
  it('returns no conflicts for a single trusted, compatible plugin', () => {
    const conflicts = run({
      plugins: [plugin({ manifest: manifest({ id: 'a' }) })],
      contributions: [shortcut('a', 'mod+shift+9'), screenContribution('a', 'a-screen')],
    })
    expect(conflicts).toEqual([])
  })
})
