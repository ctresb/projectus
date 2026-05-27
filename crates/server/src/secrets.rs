use anyhow::{Context, Result, bail};
use keyring::Entry;

use crate::{
    domain::{BackupCredentialStatus, BackupCredentials},
    platform,
};

const SERVICE: &str = "com.projectus.r2";
const ACCESS_USER: &str = "access-key-id";
const SECRET_USER: &str = "secret-access-key";

pub fn save(credentials: &BackupCredentials) -> Result<()> {
    if credentials.access_key_id.trim().is_empty()
        || credentials.secret_access_key.trim().is_empty()
    {
        bail!(
            "informe as duas credenciais R2 para fixar no {}",
            platform::credential_store_label()
        );
    }
    Entry::new(SERVICE, ACCESS_USER)?
        .set_password(&credentials.access_key_id)
        .with_context(|| {
            format!(
                "não foi possível salvar a access key no {}",
                platform::credential_store_label()
            )
        })?;
    Entry::new(SERVICE, SECRET_USER)?
        .set_password(&credentials.secret_access_key)
        .with_context(|| {
            format!(
                "não foi possível salvar a secret key no {}",
                platform::credential_store_label()
            )
        })?;
    Ok(())
}

pub fn load() -> Result<BackupCredentials> {
    Ok(BackupCredentials {
        access_key_id: Entry::new(SERVICE, ACCESS_USER)?
            .get_password()
            .with_context(|| {
                format!(
                    "credencial R2 não encontrada no {}",
                    platform::credential_store_label()
                )
            })?,
        secret_access_key: Entry::new(SERVICE, SECRET_USER)?
            .get_password()
            .with_context(|| {
                format!(
                    "segredo R2 não encontrado no {}",
                    platform::credential_store_label()
                )
            })?,
    })
}

pub fn status() -> BackupCredentialStatus {
    let store_nome = platform::credential_store_label().to_owned();
    match load() {
        Ok(credentials) => {
            let suffix: String = credentials
                .access_key_id
                .chars()
                .rev()
                .take(4)
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect();
            BackupCredentialStatus {
                fixadas: true,
                access_key_id_mascarada: Some(format!("****{suffix}")),
                store_nome,
            }
        }
        Err(_) => BackupCredentialStatus {
            fixadas: false,
            access_key_id_mascarada: None,
            store_nome,
        },
    }
}
