use std::{sync::Arc, time::Duration};

use chrono::{Duration as ChronoDuration, Utc};
use tracing::{error, info};

use crate::{backup_r2::BackupService, domain::SnapshotOrigin, storage::Storage};

pub fn spawn(storage: Arc<Storage>, backup: Arc<BackupService>) {
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(Duration::from_secs(60 * 30));
        loop {
            ticker.tick().await;
            let Ok(config) = storage.config() else {
                continue;
            };
            if !config.r2.configurado {
                continue;
            }
            let due = config
                .r2
                .ultimo_snapshot_em
                .map(|last| Utc::now() - last >= ChronoDuration::hours(24))
                .unwrap_or(true);
            if due {
                match backup.snapshot(SnapshotOrigin::Automatico).await {
                    Ok(record) => info!(snapshot = %record.id, "snapshot automático criado"),
                    Err(error) => error!(%error, "snapshot automático falhou"),
                }
            }
        }
    });
}
