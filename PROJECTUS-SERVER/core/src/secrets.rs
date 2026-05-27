use anyhow::{Context, Result, bail};
use keyring::Entry;

use crate::domain::{BackupCredentialStatus, BackupCredentials};

const SERVICE: &str = "com.projectus.r2";
const ACCESS_USER: &str = "access-key-id";
const SECRET_USER: &str = "secret-access-key";

pub fn save(credentials: &BackupCredentials) -> Result<()> {
    if credentials.access_key_id.trim().is_empty()
        || credentials.secret_access_key.trim().is_empty()
    {
        bail!("informe as duas credenciais R2 para fixar no Keychain");
    }
    Entry::new(SERVICE, ACCESS_USER)?
        .set_password(&credentials.access_key_id)
        .context("não foi possível salvar a access key no Keychain")?;
    Entry::new(SERVICE, SECRET_USER)?
        .set_password(&credentials.secret_access_key)
        .context("não foi possível salvar a secret key no Keychain")?;
    Ok(())
}

pub fn load() -> Result<BackupCredentials> {
    Ok(BackupCredentials {
        access_key_id: Entry::new(SERVICE, ACCESS_USER)?
            .get_password()
            .context("credencial R2 não encontrada no Keychain")?,
        secret_access_key: Entry::new(SERVICE, SECRET_USER)?
            .get_password()
            .context("segredo R2 não encontrado no Keychain")?,
    })
}

pub fn status() -> BackupCredentialStatus {
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
            }
        }
        Err(_) => BackupCredentialStatus {
            fixadas: false,
            access_key_id_mascarada: None,
        },
    }
}
