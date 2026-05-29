// The host runtime bridge that external (zip/url) plugins reach for.
//
// A builtin plugin is bundled with the app, so it `import`s React and host
// helpers directly. An EXTERNAL plugin is a standalone ESM the backend serves and
// the loader pulls in with the native `import()` — it has no bundler, no
// `node_modules`, and therefore cannot `import 'react'`. To still let it render a
// contributed screen / nav icon, the host publishes the React it is already
// running on a single well-known global. The external module reads it at
// activation/render time:
//
//   const { react } = globalThis.__PROJECTUS_PLUGIN_RUNTIME__
//   react.createElement('section', null, 'hello from a plugin')
//
// This is consistent with today's `DirectModuleSandbox`, which already runs the
// plugin in the host realm (so sharing the host React instance avoids a second,
// incompatible copy of React — the classic "invalid hook call" hazard). When the
// realm-isolated `IframeSandbox` lands, this bridge is replaced by the explicit
// postMessage capability channel; until then it is the documented seam.
//
// Builtins do NOT use this; they import React normally. Core stays
// plugin-agnostic: this file names no plugin id.

import * as React from 'react'

/// The shape published on `globalThis.__PROJECTUS_PLUGIN_RUNTIME__`. Kept minimal
/// on purpose: just the host React instance (enough to build elements/components).
/// Extend deliberately — every field here is ambient capability handed to
/// unsandboxed external code.
export interface ExternalPluginRuntime {
  /// The host's React instance. Use `react.createElement` to build nodes; reuse
  /// the host instance so hooks/state work across the boundary.
  readonly react: typeof React
}

declare global {
  // eslint-disable-next-line no-var
  var __PROJECTUS_PLUGIN_RUNTIME__: ExternalPluginRuntime | undefined
}

/// Publish the host runtime bridge onto the global, idempotently. Called by
/// `PluginHost` before any external plugin is loaded/activated, so a contributed
/// screen's `render` always finds React. Safe to call repeatedly.
export function installExternalPluginRuntime(): void {
  if (typeof globalThis === 'undefined') return
  if (!globalThis.__PROJECTUS_PLUGIN_RUNTIME__) {
    globalThis.__PROJECTUS_PLUGIN_RUNTIME__ = { react: React }
  }
}
