import { describe, expect, it } from 'vitest'

import { manifest as notesManifest } from '../builtin/notes/manifest'
import { ALL_PERMISSIONS, isPermissionId } from '../types/permissions'
import { ALL_INTERACTIONS, isInteractionId } from '../types/interactions'
import type { PluginManifest } from '../types/manifest'

// There is no TypeScript manifest validator (the authoritative `validate()` lives
// in the Rust backend, `crates/server/src/plugins/manifest.rs`). These are
// type-shape sanity checks over the real builtin Notes manifest plus the closed
// permission/interaction vocabularies the frontend mirrors: every value a
// manifest declares must be a member of the host's known sets, SHA-256 is the
// only integrity algorithm (never MD5), and the version/api fields are coherent.

describe('permission & interaction vocabularies', () => {
  it('ALL_PERMISSIONS has no duplicates and every member is a PermissionId', () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length)
    for (const permission of ALL_PERMISSIONS) {
      expect(isPermissionId(permission)).toBe(true)
    }
  })

  it('ALL_INTERACTIONS has no duplicates and every member is an InteractionId', () => {
    expect(new Set(ALL_INTERACTIONS).size).toBe(ALL_INTERACTIONS.length)
    for (const interaction of ALL_INTERACTIONS) {
      expect(isInteractionId(interaction)).toBe(true)
    }
  })

  it('rejects values outside the closed sets', () => {
    expect(isPermissionId('notes:delete')).toBe(false)
    expect(isPermissionId('')).toBe(false)
    expect(isInteractionId('TELEPORT')).toBe(false)
  })

  it('covers the spec-mandated permission ids', () => {
    for (const required of [
      'notes:read',
      'notes:write',
      'screens:add',
      'shortcuts:register',
      'archive:create',
      'attachments',
    ] as const) {
      expect(isPermissionId(required)).toBe(true)
    }
  })

  it('covers the spec-mandated interaction ids', () => {
    for (const required of [
      'MARKDOWN_EDITOR',
      'SIDE_NAVIGATION',
      'GLOBAL_SEARCH',
      'SETTINGS',
      'PROJECT_CARDS',
      'TASK_CARDS',
      'TAGS',
      'ARCHIVE',
      'BACKUP',
      'SECRETS',
      'NETWORK',
      'FILE_STORAGE',
      'SHORTCUTS',
      'BACKGROUND_JOBS',
    ] as const) {
      expect(isInteractionId(required)).toBe(true)
    }
  })
})

describe('builtin Notes manifest shape', () => {
  // A structural sanity walk over every top-level field, so a missing/renamed
  // field on the Rust mirror surfaces as a test failure rather than a silent
  // runtime gap.
  const m: PluginManifest = notesManifest

  it('has the required identity and presentation fields', () => {
    expect(m.id).toBe('notes')
    expect(m.id).toMatch(/^[a-z0-9-]+$/)
    expect(typeof m.title).toBe('string')
    expect(m.title.length).toBeGreaterThan(0)
    expect(m.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(typeof m.license).toBe('string')
    expect(Array.isArray(m.screenshots)).toBe(true)
  })

  it('declares a frontend entry and no backend entry (pure-frontend builtin)', () => {
    expect(typeof m.frontend_entry).toBe('string')
    expect(m.frontend_entry.length).toBeGreaterThan(0)
    expect(m.backend_entry).toBeNull()
  })

  it('has a coherent api version window enclosing min_api_version', () => {
    expect(m.api_version_range.min).toBeLessThanOrEqual(m.api_version_range.max)
    expect(m.min_api_version).toBeGreaterThan(0)
    expect(m.api_version_range.min).toBeGreaterThanOrEqual(m.min_api_version)
  })

  it('declares only permissions in the host vocabulary', () => {
    expect(m.permissions.length).toBeGreaterThan(0)
    for (const permission of m.permissions) {
      expect(isPermissionId(permission)).toBe(true)
    }
    // No duplicate declarations.
    expect(new Set(m.permissions).size).toBe(m.permissions.length)
  })

  it('declares only interactions in the host vocabulary', () => {
    for (const interaction of m.interacts_with) {
      expect(isInteractionId(interaction)).toBe(true)
    }
  })

  it('uses SHA-256 as the integrity algorithm, never MD5', () => {
    expect(m.integrity.algorithm).toBe('sha256')
    expect(m.integrity.algorithm).not.toBe('md5')
    expect('package_sha256' in m.integrity).toBe(true)
    expect('manifest_sha256' in m.integrity).toBe(true)
  })

  it('has a null signature for a builtin (trust comes from the host build)', () => {
    expect(m.signature).toBeNull()
  })

  it('declares well-formed shortcuts that match its declared permissions', () => {
    for (const sc of m.shortcuts) {
      expect(sc.id.length).toBeGreaterThan(0)
      expect(sc.keys.length).toBeGreaterThan(0)
    }
    // It declares a shortcut, so it must declare the permission to register one.
    if (m.shortcuts.length > 0) {
      expect(m.permissions).toContain('shortcuts:register')
    }
  })

  it('lists extension points consistent with its contributions', () => {
    // The Notes plugin contributes a nav item, screen, search provider, archive
    // integration and a shortcut; the manifest must enumerate those slots.
    for (const point of ['navItem', 'screen', 'searchProvider', 'archiveIntegration', 'shortcut']) {
      expect(m.extension_points).toContain(point)
    }
  })
})
