//! Namespaced, revisioned per-plugin data store.
//!
//! Every plugin gets its own sandbox under `plugins/<id>/data/<collection>.json`.
//! Each collection file is a revisioned envelope ([`PluginData`]) so writers use
//! the same optimistic-concurrency discipline the rest of PROJECTUS does: read a
//! revision, write back the revision you saw, get a [`StoreError::Conflict`] if
//! someone moved underneath you.
//!
//! The free functions take a `root: &Path` and do the raw IO; the thin
//! [`Storage`] methods at the bottom wrap them under the global write mutex so the
//! backend stays the *sole* durable writer (the HTTP layer must call the Storage
//! methods, never the free fns directly).

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::storage::{Storage, StoreError, StoreResult, atomic_json, read_json};

/// Folder (under the storage root) that holds the whole plugin subsystem on disk.
const PLUGINS_DIR: &str = "plugins";
/// Per-plugin subfolder that holds its namespaced data collections.
const DATA_DIR: &str = "data";

/// One plugin data collection: an opaque JSON `items` payload wrapped in a
/// monotonically increasing `revision` for optimistic concurrency.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginData {
    pub revision: u64,
    #[serde(default)]
    pub items: Value,
}

impl Default for PluginData {
    fn default() -> Self {
        Self {
            revision: 0,
            items: Value::Null,
        }
    }
}

/// Reject ids/collections that are not lowercase slugs, so they can never contain
/// `.`, `/`, `\`, or other path-traversal sequences before they touch the
/// filesystem.
fn ensure_safe(label: &str, value: &str) -> StoreResult<()> {
    if value.is_empty()
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        return Err(StoreError::Validation(format!(
            "{label} de plugin inválido (use apenas a-z, 0-9, '-')"
        )));
    }
    Ok(())
}

/// Absolute path to `plugins/<id>/data/`.
fn data_dir(root: &Path, id: &str) -> PathBuf {
    root.join(PLUGINS_DIR).join(id).join(DATA_DIR)
}

/// Absolute path to `plugins/<id>/data/<collection>.json`.
fn collection_path(root: &Path, id: &str, collection: &str) -> PathBuf {
    data_dir(root, id).join(format!("{collection}.json"))
}

/// Read a plugin's data collection. A missing plugin/collection is *not* an
/// error: it yields the default empty envelope (revision 0, null items) so a
/// fresh plugin can read-before-write without special-casing.
pub fn plugin_read(root: &Path, id: &str, collection: &str) -> StoreResult<PluginData> {
    ensure_safe("id", id)?;
    ensure_safe("coleção", collection)?;
    let path = collection_path(root, id, collection);
    if path.exists() {
        read_json(&path)
    } else {
        Ok(PluginData::default())
    }
}

/// Write a plugin's data collection under optimistic concurrency. The supplied
/// `revision` must equal the current on-disk revision (0 for a brand-new
/// collection); otherwise nothing is written and [`StoreError::Conflict`] is
/// returned. On success the stored revision is bumped by one and the new
/// envelope returned.
pub fn plugin_write(
    root: &Path,
    id: &str,
    collection: &str,
    revision: u64,
    items: Value,
) -> StoreResult<PluginData> {
    ensure_safe("id", id)?;
    ensure_safe("coleção", collection)?;
    let path = collection_path(root, id, collection);
    let current = if path.exists() {
        read_json::<PluginData>(&path)?.revision
    } else {
        0
    };
    if current != revision {
        return Err(StoreError::Conflict);
    }
    let next = PluginData {
        revision: revision + 1,
        items,
    };
    atomic_json(&path, &next)?;
    Ok(next)
}

/// Recursively remove a plugin's `data/` directory. Returns whether one existed.
/// Explicit-purge only — uninstall keeps data, so callers must opt in. Touches
/// only the target plugin's `data/` subfolder, never its tree or the registry.
pub fn plugin_delete_data(root: &Path, id: &str) -> StoreResult<bool> {
    ensure_safe("id", id)?;
    let dir = data_dir(root, id);
    if dir.exists() {
        std::fs::remove_dir_all(&dir)?;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Thin, mutex-guarded wrappers so the plugin data store goes through the single
/// durable writer like every other storage mutation. The HTTP layer calls these,
/// not the free fns, so the global write lock is always honoured.
impl Storage {
    /// Read a plugin data collection under the write lock.
    pub fn plugin_data(&self, id: &str, collection: &str) -> StoreResult<PluginData> {
        let _guard = self.lock_writes();
        plugin_read(self.root(), id, collection)
    }

    /// Write a plugin data collection under the write lock, emitting a live event
    /// so subscribers (and the plugin's own UI) can react.
    pub fn write_plugin_data(
        &self,
        id: &str,
        collection: &str,
        revision: u64,
        items: Value,
    ) -> StoreResult<PluginData> {
        let _guard = self.lock_writes();
        let stored = plugin_write(self.root(), id, collection, revision, items)?;
        self.emit("plugin_dados_atualizados", "plugin", id);
        Ok(stored)
    }

    /// Purge a plugin's data under the write lock, emitting a live event only when
    /// something was actually removed.
    pub fn purge_plugin_data(&self, id: &str) -> StoreResult<bool> {
        let _guard = self.lock_writes();
        let removed = plugin_delete_data(self.root(), id)?;
        if removed {
            self.emit("plugin_dados_removidos", "plugin", id);
        }
        Ok(removed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::TempDir;

    /// A storage root with `plugins/` created, mirroring `Storage::initialize`.
    fn scratch() -> TempDir {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join(PLUGINS_DIR)).unwrap();
        dir
    }

    #[test]
    fn read_of_missing_collection_is_empty_default() {
        let dir = scratch();
        let data = plugin_read(dir.path(), "notes", "items").unwrap();
        assert_eq!(data.revision, 0);
        assert_eq!(data.items, Value::Null);
    }

    #[test]
    fn first_write_requires_revision_zero_and_bumps() {
        let dir = scratch();
        let written = plugin_write(
            dir.path(),
            "notes",
            "items",
            0,
            json!([{"id": "a", "titulo": "primeira"}]),
        )
        .unwrap();
        assert_eq!(written.revision, 1);

        let back = plugin_read(dir.path(), "notes", "items").unwrap();
        assert_eq!(back.revision, 1);
        assert_eq!(back.items[0]["titulo"], "primeira");

        let next = plugin_write(dir.path(), "notes", "items", 1, json!([])).unwrap();
        assert_eq!(next.revision, 2);
    }

    #[test]
    fn stale_revision_conflicts_without_clobbering() {
        let dir = scratch();
        plugin_write(dir.path(), "notes", "items", 0, json!({"v": 1})).unwrap();

        let err = plugin_write(dir.path(), "notes", "items", 0, json!({"v": 2})).unwrap_err();
        assert!(matches!(err, StoreError::Conflict));

        // The earlier write is untouched.
        let data = plugin_read(dir.path(), "notes", "items").unwrap();
        assert_eq!(data.revision, 1);
        assert_eq!(data.items["v"], 1);
    }

    #[test]
    fn data_is_namespaced_per_plugin_and_collection() {
        let dir = scratch();
        plugin_write(dir.path(), "alpha", "one", 0, json!("alpha-one")).unwrap();
        plugin_write(dir.path(), "alpha", "two", 0, json!("alpha-two")).unwrap();
        plugin_write(dir.path(), "beta", "one", 0, json!("beta-one")).unwrap();

        assert_eq!(
            plugin_read(dir.path(), "alpha", "one").unwrap().items,
            json!("alpha-one")
        );
        assert_eq!(
            plugin_read(dir.path(), "alpha", "two").unwrap().items,
            json!("alpha-two")
        );
        assert_eq!(
            plugin_read(dir.path(), "beta", "one").unwrap().items,
            json!("beta-one")
        );
    }

    #[test]
    fn delete_data_is_isolated_and_no_op_when_absent() {
        let dir = scratch();
        plugin_write(dir.path(), "alpha", "one", 0, json!("keep-me")).unwrap();
        plugin_write(dir.path(), "beta", "one", 0, json!("delete-me")).unwrap();

        assert!(plugin_delete_data(dir.path(), "beta").unwrap());
        // beta is gone, alpha survives.
        assert_eq!(plugin_read(dir.path(), "beta", "one").unwrap().revision, 0);
        assert_eq!(
            plugin_read(dir.path(), "alpha", "one").unwrap().items,
            json!("keep-me")
        );
        // Deleting again (now absent) reports nothing removed.
        assert!(!plugin_delete_data(dir.path(), "beta").unwrap());
    }

    #[test]
    fn unsafe_ids_and_collections_are_rejected() {
        let dir = scratch();
        for bad in ["..", "a/b", "a\\b", "Notes", "with.dot", ""] {
            assert!(
                matches!(
                    plugin_read(dir.path(), bad, "items"),
                    Err(StoreError::Validation(_))
                ),
                "id {bad:?} should be rejected"
            );
            assert!(
                matches!(
                    plugin_write(dir.path(), "notes", bad, 0, json!(null)),
                    Err(StoreError::Validation(_))
                ),
                "collection {bad:?} should be rejected"
            );
        }
    }
}
