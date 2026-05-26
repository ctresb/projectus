use std::{
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};

use anyhow::{Context, Result, anyhow, bail};
use aws_config::BehaviorVersion;
use aws_credential_types::Credentials;
use aws_sdk_s3::{Client, primitives::ByteStream};
use chrono::Utc;
use sha2::{Digest, Sha256};
use tempfile::TempDir;
use url::Url;
use walkdir::WalkDir;

use crate::{
    domain::{
        BackupCredentialStatus, Manifest, ManifestFile, RemoteHistory, SnapshotOrigin,
        SnapshotRecord, id8,
    },
    secrets,
    storage::{Storage, atomic_json},
};

pub struct BackupService {
    storage: Arc<Storage>,
}

impl BackupService {
    pub fn new(storage: Arc<Storage>) -> Self {
        Self { storage }
    }

    pub async fn save_credentials(
        &self,
        credentials: crate::domain::BackupCredentials,
    ) -> Result<()> {
        secrets::save(&credentials)?;
        self.storage.mark_r2_configured(true)?;
        Ok(())
    }

    pub fn credentials_status(&self) -> BackupCredentialStatus {
        secrets::status()
    }

    pub async fn history(&self) -> Result<RemoteHistory> {
        let (client, bucket) = self.client().await?;
        get_remote_history(&client, &bucket).await
    }

    pub async fn snapshot(&self, origin: SnapshotOrigin) -> Result<SnapshotRecord> {
        let (client, bucket) = self.client().await?;
        let created = Utc::now();
        let id = format!("{}-{}", created.format("%Y%m%dT%H%M%SZ"), id8());
        let (staging, manifest_files) = stage_snapshot(self.storage.root())?;
        let bytes_total = manifest_files.iter().map(|file| file.bytes).sum();

        for file in &manifest_files {
            let bytes = fs::read(staging.path().join("PROJECTUS").join(&file.caminho))?;
            let key = format!("r2-syncs/{id}/PROJECTUS/{}", file.caminho);
            client
                .put_object()
                .bucket(&bucket)
                .key(key)
                .body(ByteStream::from(bytes.clone()))
                .send()
                .await
                .with_context(|| {
                    format!(
                        "falha ao enviar PROJECTUS/{}; o snapshot integral de {} arquivos foi interrompido",
                        file.caminho,
                        manifest_files.len()
                    )
                })?;
        }

        let manifest = Manifest {
            id: id.clone(),
            timestamp: created,
            origem: origin.clone(),
            arquivos: manifest_files,
            total_bytes: bytes_total,
        };
        client
            .put_object()
            .bucket(&bucket)
            .key(format!("r2-syncs/{id}/manifest.json"))
            .body(ByteStream::from(serde_json::to_vec_pretty(&manifest)?))
            .send()
            .await
            .context("falha ao enviar o manifesto do snapshot")?;

        let record = SnapshotRecord {
            id: id.clone(),
            timestamp: created,
            origem: origin,
            arquivos: manifest.arquivos.len(),
            bytes: bytes_total,
        };
        let mut history = get_remote_history(&client, &bucket)
            .await
            .unwrap_or_default();
        history.snapshots.insert(0, record.clone());
        client
            .put_object()
            .bucket(&bucket)
            .key("r2-syncs/history.json")
            .body(ByteStream::from(serde_json::to_vec_pretty(&history)?))
            .send()
            .await
            .context("falha ao atualizar history.json no R2")?;
        self.storage.record_snapshot(&record)?;
        Ok(record)
    }

    pub async fn restore(&self, snapshot_id: &str) -> Result<()> {
        if snapshot_id.contains('/') || snapshot_id.contains("..") {
            bail!("identificador de snapshot inválido");
        }
        let (client, bucket) = self.client().await?;
        let manifest_bytes = get_object(
            &client,
            &bucket,
            &format!("r2-syncs/{snapshot_id}/manifest.json"),
        )
        .await?;
        let manifest: Manifest = serde_json::from_slice(&manifest_bytes)?;
        let parent = self
            .storage
            .root()
            .parent()
            .ok_or_else(|| anyhow!("raiz local sem pasta pai"))?;
        let staging = TempDir::new_in(parent)?;
        let download_root = staging.path().join("PROJECTUS");

        for file in &manifest.arquivos {
            let bytes = get_object(
                &client,
                &bucket,
                &format!("r2-syncs/{snapshot_id}/PROJECTUS/{}", file.caminho),
            )
            .await?;
            if bytes.len() as u64 != file.bytes || hash(&bytes) != file.sha256 {
                bail!("checksum inválido para {}", file.caminho);
            }
            let target = download_root.join(&file.caminho);
            if let Some(dir) = target.parent() {
                fs::create_dir_all(dir)?;
            }
            fs::write(target, bytes)?;
        }

        let recovery = parent.join(format!(
            "PROJECTUS-recuperacao-{}-{}",
            Utc::now().format("%Y%m%dT%H%M%SZ"),
            id8()
        ));
        fs::rename(self.storage.root(), &recovery)
            .context("falha ao preservar a pasta local atual")?;
        if let Err(error) = fs::rename(&download_root, self.storage.root()) {
            let _ = fs::rename(&recovery, self.storage.root());
            return Err(error).context("falha ao ativar o snapshot restaurado");
        }
        self.storage.initialize()?;
        self.storage
            .emit("backup_restaurado", "backup", snapshot_id);
        Ok(())
    }

    async fn client(&self) -> Result<(Client, String)> {
        let config = self.storage.config()?;
        if config.r2.endpoint.trim().is_empty() || config.r2.bucket.trim().is_empty() {
            bail!("configure endpoint e bucket do R2 antes de salvar");
        }
        validate_r2_endpoint(&config.r2.endpoint)?;
        let credentials = secrets::load()?;
        let sdk_config = aws_config::defaults(BehaviorVersion::latest())
            .endpoint_url(config.r2.endpoint)
            .region(aws_sdk_s3::config::Region::new(config.r2.region))
            .credentials_provider(Credentials::new(
                credentials.access_key_id,
                credentials.secret_access_key,
                None,
                None,
                "projectus-keychain",
            ))
            .load()
            .await;
        let s3_config = aws_sdk_s3::config::Builder::from(&sdk_config)
            .force_path_style(true)
            .build();
        Ok((Client::from_conf(s3_config), config.r2.bucket))
    }
}

fn validate_r2_endpoint(raw: &str) -> Result<()> {
    let endpoint = Url::parse(raw.trim()).context("endereço S3 do R2 inválido")?;
    let hostname = endpoint.host_str().unwrap_or_default();
    if endpoint.scheme() != "https"
        || !hostname.ends_with(".r2.cloudflarestorage.com")
        || endpoint.path() != "/"
    {
        bail!(
            "endereço R2 inválido para snapshot: use o endpoint S3 API no formato https://<account-id>.r2.cloudflarestorage.com; domínios públicos/customizados não aceitam upload S3"
        );
    }
    Ok(())
}

async fn get_remote_history(client: &Client, bucket: &str) -> Result<RemoteHistory> {
    match get_object(client, bucket, "r2-syncs/history.json").await {
        Ok(bytes) => Ok(serde_json::from_slice(&bytes)?),
        Err(_) => Ok(RemoteHistory::default()),
    }
}

async fn get_object(client: &Client, bucket: &str, key: &str) -> Result<Vec<u8>> {
    let result = client.get_object().bucket(bucket).key(key).send().await?;
    Ok(result.body.collect().await?.into_bytes().to_vec())
}

fn durable_files(root: &Path) -> Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    for item in WalkDir::new(root).follow_links(false) {
        let item = item?;
        let name = item.file_name().to_string_lossy();
        if item.file_type().is_file() && !name.contains(".tmp-") && name != ".DS_Store" {
            files.push(item.into_path());
        }
    }
    files.sort();
    Ok(files)
}

fn stage_snapshot(root: &Path) -> Result<(TempDir, Vec<ManifestFile>)> {
    let staging = tempfile::tempdir()?;
    let staged_root = staging.path().join("PROJECTUS");
    let mut manifest_files = Vec::new();
    for source in durable_files(root)? {
        let relative = source.strip_prefix(root)?;
        let staged = staged_root.join(relative);
        if let Some(parent) = staged.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(&source, &staged)?;
        let bytes = fs::read(&staged)?;
        manifest_files.push(ManifestFile {
            caminho: remote_path(relative),
            bytes: bytes.len() as u64,
            sha256: hash(&bytes),
        });
    }
    Ok((staging, manifest_files))
}

fn remote_path(relative: &Path) -> String {
    relative
        .components()
        .map(|part| part.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

fn hash(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

#[allow(dead_code)]
fn write_manifest_locally(path: &Path, manifest: &Manifest) -> Result<()> {
    atomic_json(path, manifest).map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stages_the_entire_projectus_tree_for_a_snapshot() {
        let source = tempfile::tempdir().unwrap();
        let root = source.path().join("PROJECTUS");
        for relative in [
            "config.json",
            "board.json",
            "history.json",
            "projetos/jogo-12345678/project.json",
            "projetos/jogo-12345678/tarefas/card-12345678/card.md",
            "ideias/ideia-12345678/note.md",
            "arquivo/task-12345678/card.md",
            "arquivo/index.json",
        ] {
            let path = root.join(relative);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, relative).unwrap();
        }
        fs::write(root.join(".DS_Store"), "ignored").unwrap();
        fs::write(root.join("history.json.tmp-write"), "ignored").unwrap();

        let (staging, files) = stage_snapshot(&root).unwrap();
        let paths = files
            .iter()
            .map(|file| file.caminho.as_str())
            .collect::<Vec<_>>();

        assert_eq!(paths.len(), 8);
        assert!(paths.contains(&"config.json"));
        assert!(paths.contains(&"board.json"));
        assert!(paths.contains(&"ideias/ideia-12345678/note.md"));
        assert!(paths.contains(&"arquivo/task-12345678/card.md"));
        assert!(staging.path().join("PROJECTUS/config.json").exists());
        assert!(!paths.contains(&".DS_Store"));
    }

    #[test]
    fn accepts_only_the_cloudflare_r2_s3_endpoint() {
        assert!(validate_r2_endpoint("https://conta.r2.cloudflarestorage.com").is_ok());
        assert!(validate_r2_endpoint("https://bucket.c3b.fun/").is_err());
        assert!(validate_r2_endpoint("https://conta.r2.cloudflarestorage.com/bucket").is_err());
    }
}
