//! Plugin subsystem: manifest contract, integrity/signature trust, the
//! installed-plugin registry + lockfile, install pipelines (zip/url), the
//! namespaced revisioned plugin data store, and the `/api/plugins` router.
//!
//! Core code never names a specific plugin; it consumes this registry of
//! contributions. The builtin Notes plugin is seeded as data
//! (`registry::seed_builtins`), not wired in by name from core.

pub mod install;
pub mod manifest;
pub mod registry;
pub mod signing;
pub mod storage;

pub mod http;

pub use install::{install_from_url, install_from_zip};
pub use manifest::{
    ApiVersionRange, Command, ExtensionPoint, IntegrityMeta, Interaction, ManifestError,
    ManifestResult, MarketplaceMeta, Migration, Permission, PluginManifest, Shortcut,
    SignatureMeta,
};
pub use registry::{
    InstalledPlugin, LockEntry, PluginSource, PluginState, get, list, remove, seed_builtins,
    set_state, upsert,
};
pub use signing::{
    TrustStatus, TrustedPublishers, sha256_hex, verify_package, verify_signature,
};
pub use storage::{plugin_delete_data, plugin_read, plugin_write};
