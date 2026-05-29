// The host's single global keyboard-shortcut owner.
//
// Before plugins existed, individual features attached their own
// `window.addEventListener('keydown', …)` (the ideas quick-create handler, the
// global-search ⌘K controller). That ad-hoc model has no collision story: two
// features could silently bind the same accelerator, and a plugin had no safe
// way to register one at all. The `ShortcutManager` replaces that pattern with
// THE single global keydown listener for plugin shortcuts. Plugins never touch
// `window` directly: they register through their scoped `PluginContext`
// (`ctx.shortcuts.register`), which forwards to `register` here so every binding
// carries its owning `pluginId` and can be torn down cleanly on disable.
//
// Collision policy mirrors the conflict detector (`conflicts/detectConflicts`):
// accelerators are normalized case/order-insensitively, `cmd`/`ctrl`/`meta`/
// `control`/`command` all fold to `mod`, and the host's own reserved
// accelerators (`mod+k` for global search, `mod+n` for new) are baked in as the
// native baseline. A registration that collides with a native accelerator or
// with an already-registered binding is refused — `register` reports the
// conflict back to the caller and does NOT bind, so the host's behavior and the
// first/winning plugin both keep working. This file names no plugin id; the
// native baseline is the host's own surface, not a builtin.

/// The host's own reserved accelerators. Kept here (not derived from a plugin)
/// so the manager stays plugin-agnostic. `mod+k` opens global search and
/// `mod+n` creates a new item — both are platform-folded to `mod`.
export const NATIVE_SHORTCUT_KEYS = ['mod+k', 'mod+n'] as const

/// `otherId` value reported when a registration collides with the host's own
/// reserved surface (rather than another plugin). Matches the sentinel the
/// conflict detector uses so callers can treat both uniformly.
export const NATIVE_OWNER = '__native__'

/// A request to bind one accelerator. Mirrors the fields of a
/// `ShortcutContribution` the manager needs: who owns it, the contribution id
/// (for clean per-binding identity), the accelerator, and the handler.
export interface ShortcutRegistration {
  /// Owning plugin id; set by the runtime when it scopes the registrar.
  pluginId: string
  /// Identifier unique within the owning plugin (the contribution id).
  id: string
  /// Accelerator string, e.g. `mod+shift+n`. Normalized internally.
  keys: string
  /// Invoked with the originating event when the accelerator fires.
  run: (event: KeyboardEvent) => void
}

/// Outcome of a `register` call. `ok` is the happy path. On a collision the
/// binding is refused and `conflictWith` names the existing owner (a plugin id
/// or `NATIVE_OWNER`); on a malformed accelerator the binding is refused with
/// `reason: 'invalid'`.
export type ShortcutRegisterResult =
  | { ok: true; accelerator: string; unregister: () => void }
  | { ok: false; reason: 'conflict'; accelerator: string; conflictWith: string }
  | { ok: false; reason: 'invalid'; keys: string }

/// A live binding the manager holds. `accelerator` is the normalized key.
interface BoundShortcut {
  pluginId: string
  id: string
  accelerator: string
  run: (event: KeyboardEvent) => void
}

/// Modifier tokens that all fold to the platform-agnostic `mod`. Matches the
/// fold list in `conflicts/detectConflicts.normalizeAccelerator` so the
/// manager and the detector agree on what collides.
const MOD_ALIASES = new Set(['mod', 'cmd', 'command', 'ctrl', 'control', 'meta'])

/// Canonicalize a keyboard accelerator so `Mod+Shift+N`, `shift+mod+n`, and
/// `mod+shift+n` all compare equal: lowercase, split on `+`, fold modifier
/// aliases to `mod`, sort the modifiers, keep the final key last. Returns `''`
/// for an empty/whitespace-only accelerator (treated as invalid by callers).
function normalizeAccelerator(raw: string): string {
  const parts = raw
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => (MOD_ALIASES.has(part) ? 'mod' : part))
  if (parts.length === 0) return ''
  const key = parts[parts.length - 1]
  // A trailing modifier with no real key (e.g. `mod+shift`) is not bindable.
  if (key === 'mod' || key === 'shift' || key === 'alt') return ''
  const mods = parts.slice(0, -1).sort()
  return [...mods, key].join('+')
}

/// Derive the normalized accelerator a real `KeyboardEvent` represents, using
/// the same convention as `normalizeAccelerator`: `mod` is set when either
/// Meta or Ctrl is held (the host's platform-agnostic rule), `shift`/`alt` are
/// the literal modifiers, and the final key is the lowercased `event.key`.
/// Returns `''` for a bare modifier press so it never matches a binding.
function acceleratorFromEvent(event: KeyboardEvent): string {
  const key = event.key.toLowerCase()
  if (key === 'control' || key === 'meta' || key === 'shift' || key === 'alt') return ''
  const mods: string[] = []
  if (event.metaKey || event.ctrlKey) mods.push('mod')
  if (event.altKey) mods.push('alt')
  if (event.shiftKey) mods.push('shift')
  mods.sort()
  return [...mods, key].join('+')
}

/// True when the keystroke originates from a text-entry surface, where plugin
/// shortcuts must not steal the key. Mirrors the guard the old ideas handler
/// used so behavior is unchanged after the migration.
function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    Boolean(target.closest('[role="dialog"], [role="listbox"], [role="menu"]'))
  )
}

/// Owns the single global keydown listener for plugin shortcuts and the
/// registry of normalized accelerators. The host installs exactly one instance
/// (`shortcutManager`) and `start()`s it once at boot; the `PluginContext`
/// scopes registration so each binding carries its plugin id.
export class ShortcutManager {
  /// Live bindings keyed by normalized accelerator. One owner per accelerator;
  /// the native baseline reserves `mod+k`/`mod+n` so they can never be claimed.
  private readonly bindings = new Map<string, BoundShortcut>()

  /// The host's reserved accelerators (normalized). Never bindable by plugins.
  private readonly nativeKeys: Set<string>

  /// The installed listener, or `null` when stopped. Used to make `start()`
  /// idempotent and `stop()` a clean teardown.
  private listener: ((event: KeyboardEvent) => void) | null = null

  constructor(nativeKeys: readonly string[] = NATIVE_SHORTCUT_KEYS) {
    this.nativeKeys = new Set(
      nativeKeys.map((key) => normalizeAccelerator(key)).filter((key) => key.length > 0),
    )
  }

  /// Install the global keydown listener if it is not already running.
  /// Idempotent: calling it twice does not attach two listeners. Uses the
  /// capture phase to match the existing global-search controller and to see
  /// the key before bubble-phase feature handlers.
  start(): void {
    if (this.listener) return
    const listener = (event: KeyboardEvent) => this.handleKeyDown(event)
    this.listener = listener
    window.addEventListener('keydown', listener, { capture: true })
  }

  /// Remove the global keydown listener. Bindings are left intact so a later
  /// `start()` resumes with the same registry; use `clear()` to also drop them.
  stop(): void {
    if (!this.listener) return
    window.removeEventListener('keydown', this.listener, { capture: true })
    this.listener = null
  }

  /// Register a shortcut. Returns a discriminated result: on success the binding
  /// is live and an `unregister` closure is returned; on a collision (with a
  /// native accelerator or an already-registered binding) or an unparseable
  /// accelerator the binding is refused and the reason is reported. The manager
  /// never silently overrides an existing owner.
  register(registration: ShortcutRegistration): ShortcutRegisterResult {
    const accelerator = normalizeAccelerator(registration.keys)
    if (accelerator === '') {
      return { ok: false, reason: 'invalid', keys: registration.keys }
    }

    if (this.nativeKeys.has(accelerator)) {
      return { ok: false, reason: 'conflict', accelerator, conflictWith: NATIVE_OWNER }
    }

    const existing = this.bindings.get(accelerator)
    if (existing) {
      return { ok: false, reason: 'conflict', accelerator, conflictWith: existing.pluginId }
    }

    this.bindings.set(accelerator, {
      pluginId: registration.pluginId,
      id: registration.id,
      accelerator,
      run: registration.run,
    })

    return {
      ok: true,
      accelerator,
      unregister: () => {
        // Only remove if this exact binding still owns the accelerator, so a
        // re-registration by another plugin after teardown is never clobbered.
        const current = this.bindings.get(accelerator)
        if (current && current.pluginId === registration.pluginId && current.id === registration.id) {
          this.bindings.delete(accelerator)
        }
      },
    }
  }

  /// Remove every binding owned by `pluginId`. The host calls this on disable /
  /// uninstall (alongside `PluginRegistry.unregisterPlugin`) so a plugin's
  /// accelerators free up immediately, with no restart.
  unregisterPlugin(pluginId: string): void {
    for (const [accelerator, binding] of this.bindings) {
      if (binding.pluginId === pluginId) {
        this.bindings.delete(accelerator)
      }
    }
  }

  /// Whether `keys` would collide with a native accelerator or an existing
  /// binding. Lets the host (or conflict report) pre-check without binding.
  hasConflict(keys: string): boolean {
    const accelerator = normalizeAccelerator(keys)
    if (accelerator === '') return false
    return this.nativeKeys.has(accelerator) || this.bindings.has(accelerator)
  }

  /// The normalized accelerators currently bound by plugins (not the native
  /// baseline). Handy for diagnostics and tests.
  registeredAccelerators(): string[] {
    return [...this.bindings.keys()]
  }

  /// Drop all plugin bindings (the native baseline is permanent). Does not stop
  /// the listener.
  clear(): void {
    this.bindings.clear()
  }

  /// The global keydown handler. Resolves the keystroke to a normalized
  /// accelerator and runs the matching binding, if any. Ignores keystrokes from
  /// text-entry surfaces and composition so typing is never hijacked. Native
  /// accelerators (`mod+k`/`mod+n`) are intentionally NOT handled here — the
  /// host owns those through its own controllers — so a plugin binding can never
  /// shadow them.
  private handleKeyDown(event: KeyboardEvent): void {
    if (event.isComposing) return
    if (isEditingTarget(event.target)) return

    const accelerator = acceleratorFromEvent(event)
    if (accelerator === '' || this.nativeKeys.has(accelerator)) return

    const binding = this.bindings.get(accelerator)
    if (!binding) return

    event.preventDefault()
    event.stopPropagation()
    binding.run(event)
  }
}

/// The process-wide shortcut manager the host installs. The `PluginHost`
/// `start()`s it at boot and `PluginContext` hands plugins a scoped registrar
/// that forwards to `register`/`unregisterPlugin` here.
export const shortcutManager = new ShortcutManager()
