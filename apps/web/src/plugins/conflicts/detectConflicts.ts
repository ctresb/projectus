// Pure conflict detector for the plugin subsystem.
//
// Given the set of installed plugins (their manifests + persisted trust/state)
// and the contributions they would register, this computes every reason a
// plugin must not — or cannot safely — be activated. It is a *pure* function:
// no I/O, no registry mutation, no React. `PluginHost` calls it on boot and on
// every enable/disable to decide which plugins are safe to activate and to
// surface a typed report to the settings UI.
//
// Core stays plugin-agnostic: this file names no plugin id. The host's own
// reserved surface (native shortcut accelerators, native editor node names,
// native screen ids and toolbar slots) is passed in as a `NativeBaseline` that
// the host derives from its real `nodeRegistry` / Shell nav at the call site —
// the detector never hard-codes a builtin.
//
// SHA-256 is the integrity authority and it lives in the backend; the detector
// only *consumes* the backend's `TrustStatus` verdict (`mismatch` is fatal). It
// never recomputes a digest and it never accepts MD5.

import type { PluginManifest } from '../types/manifest'
import type { PermissionId } from '../types/permissions'
import type { AnyContribution } from '../types/extension-points'

// --- Inputs ----------------------------------------------------------------

/// The backend trust verdict, mirroring `TrustStatus` in
/// `crates/server/src/plugins/signing.rs` (serde `kebab-case`). The backend is
/// the verification authority; the detector treats `'mismatch'` as fatal and
/// otherwise trusts the recorded verdict verbatim. `'builtin'` marks a
/// first-party plugin that ships inside PROJECTUS — it is implicitly trusted and
/// can NEVER be a fatal integrity conflict.
export type TrustStatus = 'verified' | 'signed-untrusted' | 'unsigned' | 'mismatch' | 'builtin'

/// A plugin's enabled/disabled state, mirroring `PluginState` (serde
/// `kebab-case`) in `crates/server/src/plugins/registry.rs`.
export type PluginState = 'enabled' | 'disabled'

/// Where a plugin came from, mirroring `PluginSource` (serde `kebab-case`).
/// `'builtin'` plugins ship with the host; an external plugin that contributes
/// to the same surface a builtin already owns is *superseded* (the builtin
/// wins), which the detector reports.
export type PluginSource = 'builtin' | 'zip' | 'url'

/// One installed plugin as the detector needs to see it. This is the subset of
/// the backend `InstalledPlugin` record (`{ manifest, state, source, trust }`)
/// the conflict analysis depends on; the host passes its `/api/plugins`
/// response rows straight through.
export interface InstalledPluginInput {
  manifest: PluginManifest
  state: PluginState
  source: PluginSource
  trust: TrustStatus
}

/// The host's own reserved surface, derived by the caller from the live native
/// app (Shell nav, `nodeRegistry`, toolbar, native keybindings). Passing it in
/// keeps the detector pure and core-agnostic: it learns what the host occupies
/// without this file ever naming a builtin or importing a native module.
export interface NativeBaseline {
  /// Accelerator strings the host owns, e.g. `['mod+k', 'mod+n']`.
  shortcutKeys?: readonly string[]
  /// Native screen ids already routed by the host (e.g. `projetos`, `config`).
  screenIds?: readonly string[]
  /// Native editor node `getType()` names already in `nodeRegistry`.
  editorNodeNames?: readonly string[]
  /// Native editor toolbar slot ids already occupied.
  toolbarSlots?: readonly string[]
  /// The host's current API version (`API_VERSION`, currently 7). A plugin
  /// whose `api_version_range.min` exceeds this is too new to run.
  apiVersion: number
}

/// Permissions the user has switched off for a given plugin, even though its
/// manifest declares them. Keyed by plugin id; a contribution that needs a
/// disabled permission is reported (and must not activate).
export type DisabledPermissions = Readonly<Record<string, readonly PermissionId[]>>

/// The full input to `detectConflicts`. `contributions` is the flat list every
/// to-be-activated plugin would register (each carries its own `pluginId`);
/// the host gathers them by dry-loading manifests / activation metadata.
export interface ConflictDetectionInput {
  plugins: readonly InstalledPluginInput[]
  contributions: readonly AnyContribution[]
  native: NativeBaseline
  /// Optional per-plugin user-disabled permissions. Defaults to none.
  disabledPermissions?: DisabledPermissions
}

// --- Output ----------------------------------------------------------------

/// Every kind of conflict the detector can report. Stable string literals so the
/// settings UI can switch on `kind` and localize a message per case.
export type PluginConflictKind =
  /// Two plugins (or a plugin and the host) bind the same shortcut accelerator.
  | 'duplicate-shortcut'
  /// A plugin declares one of PROJECTUS's own reserved accelerators (`mod+k` /
  /// `mod+n`). This is NOT a hard conflict: the accelerator belongs to the host
  /// and is delegated to whatever screen/plugin is active, so the plugin may
  /// still declare it (and show it in its shortcut list). Informational only.
  | 'reserved-delegated'
  /// Two plugins contribute the same screen id / nav route (or it shadows a
  /// native screen).
  | 'duplicate-screen'
  /// Two plugins claim the same editor toolbar slot.
  | 'duplicate-toolbar-slot'
  /// Two plugins (or a plugin and the host) register the same Lexical node name,
  /// which Lexical forbids — the editor would throw on registration.
  | 'incompatible-node-name'
  /// The plugin's minimum API version is newer than the host build.
  | 'api-version-too-new'
  /// A contribution needs a permission the user has disabled for that plugin.
  | 'permission-disabled'
  /// An external plugin contributes to a surface a builtin already owns; the
  /// builtin supersedes it.
  | 'native-supersede'
  /// The backend trust verdict is `mismatch` (SHA-256 failed or signature
  /// invalid). Fatal: the plugin must never activate.
  | 'integrity-mismatch'
  /// The plugin's manifest names another plugin in `conflicts` and that plugin
  /// is also present, so the two cannot coexist.
  | 'declared-conflict'

/// Severity drives whether the host will still attempt activation. `'fatal'`
/// (integrity mismatch, API too new, permission disabled, declared conflict)
/// blocks the plugin entirely; `'warning'` (duplicate slot/shortcut/node/screen,
/// native supersede) lets the host pick a winner and skip the loser; `'info'`
/// (reserved-delegated) is purely advisory and never blocks or skips anything.
export type PluginConflictSeverity = 'fatal' | 'warning' | 'info'

/// A single detected conflict. `pluginId` is the plugin the conflict is reported
/// *against* (the one that will be blocked/skipped). `otherId` is the colliding
/// counterpart when the conflict is between two parties (a second plugin or the
/// `'__native__'` host sentinel); `null` for self-contained conflicts
/// (integrity, api version). `detail` carries the colliding value (the key,
/// slot, node name, permission, etc.) for display.
///
/// For a `'reserved-delegated'` row (`severity: 'info'`), `otherId` is always
/// the `NATIVE_OWNER` sentinel (the host owns the accelerator), `detail` is the
/// accelerator string (e.g. `shortcut "mod+n"`), and `reservedKey` carries the
/// normalized accelerator so the UI can render the delegated key explicitly.
export interface PluginConflict {
  kind: PluginConflictKind
  severity: PluginConflictSeverity
  pluginId: string
  otherId: string | null
  detail: string
  message: string
  /// Only present on `'reserved-delegated'`: the normalized native accelerator
  /// (e.g. `mod+n`) that the plugin declared and the host delegates to it.
  reservedKey?: string
}

/// Sentinel `otherId` for a collision with the host's own reserved surface.
export const NATIVE_OWNER = '__native__'

// --- Implementation --------------------------------------------------------

/// Detect every conflict in `input`. Pure: same input → same output, no side
/// effects. Results are returned in a stable order (fatal-then-warning is *not*
/// enforced — order follows detection pass order so the report is deterministic
/// and diffable; callers that want severity grouping can sort).
export function detectConflicts(input: ConflictDetectionInput): PluginConflict[] {
  const { plugins, contributions, native } = input
  const disabledPermissions = input.disabledPermissions ?? {}
  const conflicts: PluginConflict[] = []

  // Index plugins by id for source/trust/manifest lookups.
  const pluginById = new Map<string, InstalledPluginInput>()
  for (const plugin of plugins) {
    pluginById.set(plugin.manifest.id, plugin)
  }

  // 1. Integrity mismatch — fatal, the backend's word is final. A `'builtin'`
  //    (first-party) trust verdict is implicitly trusted and is never a fatal
  //    integrity conflict, so a bundled plugin never looks like an unsafe
  //    external package.
  for (const plugin of plugins) {
    if (plugin.trust === 'builtin') continue
    if (plugin.trust === 'mismatch') {
      conflicts.push({
        kind: 'integrity-mismatch',
        severity: 'fatal',
        pluginId: plugin.manifest.id,
        otherId: null,
        detail: plugin.manifest.integrity.package_sha256 || plugin.manifest.id,
        message: `Plugin "${plugin.manifest.id}" failed integrity verification (SHA-256 mismatch or invalid signature) and cannot be activated.`,
      })
    }
  }

  // 2. API version too new — the plugin needs a newer host build than this one.
  for (const plugin of plugins) {
    const min = plugin.manifest.api_version_range?.min ?? plugin.manifest.min_api_version
    if (typeof min === 'number' && min > native.apiVersion) {
      conflicts.push({
        kind: 'api-version-too-new',
        severity: 'fatal',
        pluginId: plugin.manifest.id,
        otherId: null,
        detail: `requires >= ${min}, host is ${native.apiVersion}`,
        message: `Plugin "${plugin.manifest.id}" requires host API version ${min}, but this build is ${native.apiVersion}.`,
      })
    }
  }

  // 3. Declared conflicts — manifest `conflicts: [otherId]` where the other is
  //    also present. Reported once per ordered (plugin, other) pair so both
  //    directions surface independently.
  for (const plugin of plugins) {
    for (const otherId of plugin.manifest.conflicts) {
      if (otherId !== plugin.manifest.id && pluginById.has(otherId)) {
        conflicts.push({
          kind: 'declared-conflict',
          severity: 'fatal',
          pluginId: plugin.manifest.id,
          otherId,
          detail: otherId,
          message: `Plugin "${plugin.manifest.id}" declares it cannot coexist with "${otherId}", which is also installed.`,
        })
      }
    }
  }

  // 4. Permission disabled by the user — any contribution whose required
  //    permission has been switched off for its owning plugin.
  for (const contribution of contributions) {
    const disabled = disabledPermissions[contribution.pluginId]
    if (!disabled || disabled.length === 0) continue
    const required = requiredPermission(contribution)
    if (required && disabled.includes(required)) {
      conflicts.push({
        kind: 'permission-disabled',
        severity: 'fatal',
        pluginId: contribution.pluginId,
        otherId: null,
        detail: required,
        message: `Plugin "${contribution.pluginId}" contribution "${contribution.id}" needs permission "${required}", which the user disabled.`,
      })
    }
  }

  // The remaining passes key on contribution slots. Walk the flat list once,
  // bucketing by the value each surface collides on. Builtin-source plugins win
  // ties (native supersede); among non-builtins, first-seen wins and later ones
  // are the reported losers.

  // 5. Duplicate shortcut accelerators (normalized) — across plugins and vs the
  //    host's native keybindings. A plugin declaring a host-RESERVED accelerator
  //    (`mod+k`/`mod+n`) is NOT a hard conflict: the accelerator belongs to
  //    PROJECTUS and is delegated to the active screen/plugin, so it is reported
  //    as an informational `reserved-delegated` row instead of a supersede.
  detectKeyedCollisions({
    contributions,
    pluginById,
    conflicts,
    kind: 'duplicate-shortcut',
    severity: 'warning',
    nativeKeys: native.shortcutKeys ?? [],
    keyOf: (c) => ('keys' in c && 'run' in c ? c.keys : null),
    describe: (key) => `shortcut "${key}"`,
    // When the colliding owner is the native host, emit an info-level
    // reserved-delegated row carrying the normalized accelerator.
    onNativeReserved: ({ pluginId, normalizedKey, detail }) => ({
      kind: 'reserved-delegated',
      severity: 'info',
      pluginId,
      otherId: NATIVE_OWNER,
      detail,
      reservedKey: normalizedKey,
      message: `O atalho "${normalizedKey}" pertence ao PROJECTUS e é delegado à tela/plugin ativo; o plugin "${pluginId}" pode declará-lo, mas não o substitui.`,
    }),
  })

  // 6. Duplicate screen ids / nav routes — across plugins and vs native screens.
  //    Both `ScreenContribution.id` and `NavItemContribution.screen` claim a
  //    route; either claiming a taken id is a collision. A nav item points at a
  //    screen via `screen`; a screen contribution claims its own `id`.
  detectKeyedCollisions({
    contributions,
    pluginById,
    conflicts,
    kind: 'duplicate-screen',
    severity: 'warning',
    nativeKeys: native.screenIds ?? [],
    keyOf: (c) => {
      if ('screen' in c && typeof c.screen === 'string') return c.screen
      if ('render' in c && !('title' in c) && !('cardKind' in c)) return c.id
      return null
    },
    describe: (key) => `screen "${key}"`,
  })

  // 7. Duplicate toolbar slots — across plugins and vs native toolbar slots.
  detectKeyedCollisions({
    contributions,
    pluginById,
    conflicts,
    kind: 'duplicate-toolbar-slot',
    severity: 'warning',
    nativeKeys: native.toolbarSlots ?? [],
    keyOf: (c) => ('slot' in c ? c.slot : null),
    describe: (key) => `toolbar slot "${key}"`,
  })

  // 8. Incompatible editor node names — Lexical forbids two nodes with the same
  //    `getType()`. Across plugins and vs native nodes.
  detectKeyedCollisions({
    contributions,
    pluginById,
    conflicts,
    kind: 'incompatible-node-name',
    severity: 'warning',
    nativeKeys: native.editorNodeNames ?? [],
    keyOf: (c) => ('nodeName' in c ? c.nodeName : null),
    describe: (key) => `editor node "${key}"`,
  })

  return conflicts
}

// --- Internals -------------------------------------------------------------

/// Map a contribution to the single permission its surface gates on. Uses
/// `in`-narrowing over the `AnyContribution` union — no casts — so it tracks the
/// real contribution shapes. Mirrors the extension-point → permission mapping
/// the runtime `PluginContext` enforces, so the detector can pre-empt a throw at
/// activation. Returns `null` for surfaces with no single gating permission.
function requiredPermission(c: AnyContribution): PermissionId | null {
  if ('keys' in c && 'run' in c) return 'shortcuts:register'
  if ('nodeName' in c) return 'editor:extend'
  if ('transformer' in c) return 'editor:extend'
  if ('slot' in c) return 'editor:extend'
  if ('keywords' in c) return 'editor:extend'
  if ('entries' in c) return 'search:provide'
  if ('entityType' in c) return 'archive:create'
  if ('intervalMs' in c) return 'background-jobs'
  if ('screen' in c) return 'screens:add'
  if ('render' in c && 'title' in c) return 'settings:add'
  if ('render' in c && !('cardKind' in c)) return 'screens:add'
  if ('title' in c && 'run' in c) return 'commands:register'
  return null
}

/// Arguments handed to {@link KeyedCollisionPass.onNativeReserved} when an
/// external plugin claims a key the native host reserves.
interface NativeReservedHit {
  /// The claiming plugin's id.
  pluginId: string
  /// The normalized key (e.g. `mod+n`) the host reserves.
  normalizedKey: string
  /// The display string from `describe(value)` (e.g. `shortcut "mod+n"`).
  detail: string
}

interface KeyedCollisionPass {
  contributions: readonly AnyContribution[]
  pluginById: Map<string, InstalledPluginInput>
  conflicts: PluginConflict[]
  kind: PluginConflictKind
  severity: PluginConflictSeverity
  nativeKeys: readonly string[]
  keyOf: (c: AnyContribution) => string | null
  describe: (key: string) => string
  /// Optional override for the "external plugin claims a HOST-RESERVED key"
  /// case. When supplied, the returned conflict replaces the default
  /// `native-supersede` row for that case (used by the shortcut pass to emit an
  /// informational `reserved-delegated` instead of a blocking-feeling supersede).
  /// Returning the row lets the pass stay generic while the caller controls the
  /// kind/severity/message for its own surface.
  onNativeReserved?: (hit: NativeReservedHit) => PluginConflict
}

/// Generic "two owners claim the same key" pass. Builtin-source plugins and the
/// native host both supersede external plugins (reported as `native-supersede`);
/// among external plugins the first claimant wins and subsequent claimants are
/// the reported losers. A plugin colliding with ITSELF (the same plugin id
/// already owns the key, e.g. a builtin host registration plus the same plugin's
/// own contribution) is never flagged — a plugin cannot conflict with itself.
function detectKeyedCollisions(pass: KeyedCollisionPass): void {
  const { contributions, pluginById, conflicts, kind, severity, nativeKeys, keyOf, describe, onNativeReserved } = pass

  const nativeOwned = new Set(nativeKeys.map((k) => normalizeKey(kind, k)))
  // The winning owner per key reported in the conflict (`otherId`): NATIVE_OWNER
  // for a builtin/native claim, else the first external plugin id that claimed
  // it. Kept verbatim so a builtin/native supersede still reports NATIVE_OWNER.
  const owner = new Map<string, string>()
  // The plugin id of whoever actually made the winning claim, so a later claim
  // by the SAME plugin is recognised as self (and never flagged) — even when the
  // recorded `owner` is collapsed to NATIVE_OWNER for a builtin. The native host
  // itself (a pre-seeded reserved key) has no plugin id, so its keys are absent.
  const ownerPlugin = new Map<string, string>()
  // Keys the native host genuinely reserves (vs merely a builtin's claim), so an
  // external claim onto one is delegated/superseded rather than a duplicate.
  const hostReserved = new Set<string>(nativeOwned)

  for (const rawKey of nativeOwned) {
    owner.set(rawKey, NATIVE_OWNER)
  }

  for (const contribution of contributions) {
    const value = keyOf(contribution)
    if (value == null || value === '') continue
    const key = normalizeKey(kind, value)
    const pluginId = contribution.pluginId
    const isBuiltin = pluginById.get(pluginId)?.source === 'builtin'

    const existing = owner.get(key)
    if (existing === undefined) {
      // First claimant. A builtin claim is recorded as the native owner so any
      // later external claim is a supersede; either way remember the real plugin
      // id so the SAME plugin claiming again is treated as self, not a conflict.
      owner.set(key, isBuiltin ? NATIVE_OWNER : pluginId)
      ownerPlugin.set(key, pluginId)
      continue
    }

    // A plugin never conflicts with itself: if the same plugin already owns this
    // key (e.g. a builtin host registration plus that builtin's own
    // contribution, or it contributed the same key twice), skip it.
    if (ownerPlugin.get(key) === pluginId) continue

    // Host genuinely reserves this key and a plugin is claiming it: let the
    // caller reclassify (e.g. shortcut → reserved-delegated). Applies to BOTH
    // builtin and external plugins — the accelerator belongs to the host either
    // way and is delegated to the active screen/plugin, never a hard conflict.
    if (hostReserved.has(key) && onNativeReserved) {
      conflicts.push(onNativeReserved({ pluginId, normalizedKey: key, detail: describe(value) }))
      continue
    }

    // Key already owned → this contribution is the loser.
    const supersededByNative = existing === NATIVE_OWNER
    conflicts.push({
      kind: supersededByNative && !isBuiltin ? 'native-supersede' : kind,
      severity,
      pluginId,
      otherId: existing,
      detail: describe(value),
      message: supersededByNative && !isBuiltin
        ? `Plugin "${pluginId}" contributes ${describe(value)}, which the host already provides; the native version takes precedence.`
        : `Plugin "${pluginId}" and ${existing === NATIVE_OWNER ? 'the host' : `"${existing}"`} both contribute ${describe(value)}.`,
    })
  }
}

/// Normalize a value for collision keying. Shortcuts get accelerator
/// normalization (case/order-insensitive); everything else is compared
/// verbatim (node names and slot/screen ids are case-sensitive identifiers).
function normalizeKey(kind: PluginConflictKind, value: string): string {
  return kind === 'duplicate-shortcut' ? normalizeAccelerator(value) : value
}

/// Canonicalize a keyboard accelerator so `Mod+Shift+N`, `shift+mod+n`, and
/// `mod+shift+n` all compare equal: lowercase, split on `+`, sort modifiers,
/// keep the final key last. `cmd`/`ctrl`/`meta`/`control`/`command` all fold to
/// `mod` to match the host's platform-agnostic accelerator convention.
function normalizeAccelerator(raw: string): string {
  const parts = raw
    .toLowerCase()
    .split('+')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => (MOD_ALIASES.has(p) ? 'mod' : p))
  if (parts.length === 0) return ''
  const key = parts[parts.length - 1]
  const mods = parts.slice(0, -1).sort()
  return [...mods, key].join('+')
}

const MOD_ALIASES = new Set(['mod', 'cmd', 'command', 'ctrl', 'control', 'meta'])
