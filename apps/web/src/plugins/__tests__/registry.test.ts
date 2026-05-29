import { describe, expect, it, vi } from 'vitest'

import { PluginRegistry } from '../registry/PluginRegistry'
import type {
  NavItemContribution,
  ScreenContribution,
  SearchProviderContribution,
  ShortcutContribution,
} from '../types/extension-points'
import { buildSearchEntries, searchEntries } from '../../features/search/searchIndex'
import type { GlobalSearchEntry } from '../../features/search/types'
import type { Bootstrap } from '../../lib/types'
import type { TFn } from '../../i18n'

// --- Builders --------------------------------------------------------------

function navItem(pluginId: string, screen: string): NavItemContribution {
  return { pluginId, id: `${pluginId}-nav`, label: pluginId, icon: () => null, screen }
}

function screenContribution(pluginId: string, id: string): ScreenContribution {
  return { pluginId, id, render: () => null }
}

function shortcut(pluginId: string, keys: string): ShortcutContribution {
  return { pluginId, id: `${pluginId}-sc`, keys, run: () => undefined }
}

describe('PluginRegistry: register / unregister', () => {
  it('exposes registered contributions through the matching getters', () => {
    const registry = new PluginRegistry()
    registry.registerNavItem(navItem('notes', 'notes'))
    registry.registerScreen(screenContribution('notes', 'notes'))
    registry.registerShortcut(shortcut('notes', 'mod+n'))

    expect(registry.navItems().map((c) => c.pluginId)).toEqual(['notes'])
    expect(registry.screens().map((c) => c.id)).toEqual(['notes'])
    expect(registry.shortcuts().map((c) => c.keys)).toEqual(['mod+n'])
  })

  it('orders nav items by their order hint, then insertion order', () => {
    const registry = new PluginRegistry()
    registry.registerNavItem({ ...navItem('b', 'b'), order: 2 })
    registry.registerNavItem({ ...navItem('a', 'a'), order: 1 })
    registry.registerNavItem(navItem('c', 'c')) // no order -> sorts last

    expect(registry.navItems().map((c) => c.pluginId)).toEqual(['a', 'b', 'c'])
  })

  it('unregisterPlugin drops every contribution owned by that plugin only', () => {
    const registry = new PluginRegistry()
    registry.registerNavItem(navItem('notes', 'notes'))
    registry.registerScreen(screenContribution('notes', 'notes'))
    registry.registerShortcut(shortcut('notes', 'mod+n'))
    registry.registerNavItem(navItem('other', 'other'))

    registry.unregisterPlugin('notes')

    expect(registry.navItems().map((c) => c.pluginId)).toEqual(['other'])
    expect(registry.screens()).toHaveLength(0)
    expect(registry.shortcuts()).toHaveLength(0)
  })

  it('snapshot is referentially stable until a mutation, then changes', () => {
    const registry = new PluginRegistry()
    const first = registry.snapshot()
    expect(registry.snapshot()).toBe(first) // cached, same reference

    registry.registerNavItem(navItem('notes', 'notes'))
    const second = registry.snapshot()
    expect(second).not.toBe(first)
    expect(second.navItems).toHaveLength(1)
  })

  it('subscribe notifies on every mutation and the unsub stops notifications', () => {
    const registry = new PluginRegistry()
    const listener = vi.fn()
    const unsub = registry.subscribe(listener)

    registry.registerNavItem(navItem('notes', 'notes'))
    registry.unregisterPlugin('notes')
    expect(listener).toHaveBeenCalledTimes(2)

    unsub()
    registry.registerNavItem(navItem('again', 'again'))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('unregisterPlugin does not notify when nothing was owned by the id', () => {
    const registry = new PluginRegistry()
    registry.registerNavItem(navItem('notes', 'notes'))
    const listener = vi.fn()
    registry.subscribe(listener)

    registry.unregisterPlugin('nobody')
    expect(listener).not.toHaveBeenCalled()
  })
})

// --- Notes search provider integration -------------------------------------
//
// The spec's headline registry behavior: a plugin's search provider entries
// appear in the merged global-search index while registered, and disappear the
// moment the plugin is unregistered. We register a Notes-style provider (the same
// `SearchProviderContribution` shape the Notes plugin uses: note entries plus the
// `note`/`notas` scope aliases) and feed `registry.searchProviders()` straight
// into the core `buildSearchEntries`, exactly as the host does — core never names
// the plugin, it just consumes the registry.

const t: TFn = (key) => {
  const values: Record<string, string> = {
    'search.kind.archive': 'arquivo',
    'search.location.archive': 'arquivo',
    'shell.nav.projetos': 'projetos',
    'shell.nav.arquivo': 'arquivo',
    'shell.nav.backup': 'snapshots',
    'shell.nav.config': 'ajustes',
    'search.screen_summary.projects': 'quadro',
    'search.screen_summary.archive': 'arquivo',
    'search.screen_summary.backup': 'snapshots',
    'search.screen_summary.settings': 'ajustes',
  }
  return values[key] ?? key
}

const workspace: Bootstrap = {
  config: {
    schema_version: 1,
    revision: 1,
    porta: 4387,
    colunas: [],
    tags: [],
    cores: [],
    r2: { endpoint: '', bucket: '', region: 'auto', configurado: false, ultimo_snapshot_em: null },
    cor_principal: '#55B9F7',
    lan_exposto: false,
    idioma: 'pt-BR',
  },
  board: { revision: 1, projetos: [] },
  notes: { revision: 1, notas: [] },
}

/// A Notes-style provider: one note entry plus the `note`/`notas` scope aliases,
/// using the current valid `plugin` search kind. Mirrors what the Notes plugin
/// contributes via `ctx.contributes.addSearchProvider`.
function notesSearchProvider(pluginId: string): SearchProviderContribution {
  const noteEntry: GlobalSearchEntry = {
    id: 'note:note-1',
    kind: 'plugin',
    title: 'Busca rapida',
    location: 'notas',
    color: '#FAD344',
    updatedAt: '2026-05-29T00:00:00Z',
    searchText: 'busca rapida notas',
    scopeText: 'notas busca rapida',
    action: { type: 'plugin', pluginId, screen: 'notes', focus: 'note-1' },
  }
  return {
    pluginId,
    id: 'search',
    entries: () => [noteEntry],
    scopeAliases: { note: ['plugin'], notas: ['plugin'] },
    colors: { plugin: '#FAD344' },
  }
}

describe('PluginRegistry: notes search provider integration', () => {
  it('merges provider entries into the global search index while registered', () => {
    const registry = new PluginRegistry()
    registry.registerSearchProvider(notesSearchProvider('notes'))

    const entries = buildSearchEntries({ workspace, searchProviders: registry.searchProviders(), t })

    expect(entries.some((entry) => entry.id === 'note:note-1')).toBe(true)
    // The provider's `note`/`notas` scope aliases are live, so a scoped query
    // filters to the note kind.
    const scoped = searchEntries(entries, 'notas/busca')
    expect(scoped.map((entry) => entry.id)).toContain('note:note-1')
  })

  it('removes provider entries from the index after unregisterPlugin', () => {
    const registry = new PluginRegistry()
    registry.registerSearchProvider(notesSearchProvider('notes'))

    // Sanity: present before teardown.
    let entries = buildSearchEntries({ workspace, searchProviders: registry.searchProviders(), t })
    expect(entries.some((entry) => entry.id === 'note:note-1')).toBe(true)

    registry.unregisterPlugin('notes')

    entries = buildSearchEntries({ workspace, searchProviders: registry.searchProviders(), t })
    expect(entries.some((entry) => entry.id === 'note:note-1')).toBe(false)
    // The alias is gone too: `notas/` no longer scopes to a note kind, so the
    // query yields no plugin-kind hits.
    expect(searchEntries(entries, 'notas/busca')).toHaveLength(0)
  })
})
