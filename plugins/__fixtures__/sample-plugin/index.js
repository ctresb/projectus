// Sample plugin ESM entry — test fixture only.
// Loaded by the native ESM module loader (dynamic import of a URL). Never eval'd.
// Used by frontend loader tests and as the payload of backend install/verify tests.

/**
 * Called by the host when the plugin is enabled.
 * @param {object} context - Host-provided plugin context (registry, storage, etc.).
 */
export function activate(context) {
  return { id: "sample-plugin", status: "activated" };
}

/**
 * Called by the host when the plugin is disabled or uninstalled.
 */
export function deactivate() {
  return { id: "sample-plugin", status: "deactivated" };
}

export default { activate, deactivate };
