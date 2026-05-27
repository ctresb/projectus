use anyhow::{Context, Result, bail};
use keyring::Entry;
use rand::{Rng, distr::Alphanumeric};
use serde::Serialize;

const SERVICE: &str = "com.projectus.server";
const TOKEN_USER: &str = "api-token";
const ENV_TOKEN: &str = "PROJECTUS_SERVER_TOKEN";

#[derive(Debug, Clone, Serialize)]
pub struct ServerTokenStatus {
    pub configurado: bool,
    pub mascarado: Option<String>,
}

pub fn token_from_headless_args() -> Result<String> {
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        if arg == "--token" {
            if let Some(value) = args.next() {
                return validate_token(value);
            }
        }
    }
    if let Ok(value) = std::env::var(ENV_TOKEN) {
        return validate_token(value);
    }
    bail!(
        "PROJECTUS-SERVER headless exige token: use PROJECTUS_SERVER_TOKEN ou --token <token>"
    )
}

pub fn ensure_managed_token() -> Result<String> {
    if let Ok(value) = std::env::var(ENV_TOKEN) {
        let token = validate_token(value)?;
        save_managed_token(&token)?;
        return Ok(token);
    }
    match load_managed_token() {
        Ok(token) => Ok(token),
        Err(_) => {
            let token = generate_token();
            save_managed_token(&token)?;
            Ok(token)
        }
    }
}

pub fn load_managed_token() -> Result<String> {
    let token = Entry::new(SERVICE, TOKEN_USER)?
        .get_password()
        .context("token do PROJECTUS-SERVER não encontrado no Keychain")?;
    validate_token(token)
}

pub fn save_managed_token(token: &str) -> Result<()> {
    let token = validate_token(token.to_owned())?;
    Entry::new(SERVICE, TOKEN_USER)?
        .set_password(&token)
        .context("não foi possível salvar o token do servidor no Keychain")?;
    Ok(())
}

pub fn regenerate_managed_token() -> Result<String> {
    let token = generate_token();
    save_managed_token(&token)?;
    Ok(token)
}

pub fn status() -> ServerTokenStatus {
    match load_managed_token() {
        Ok(token) => ServerTokenStatus {
            configurado: true,
            mascarado: Some(mask_token(&token)),
        },
        Err(_) => ServerTokenStatus {
            configurado: false,
            mascarado: None,
        },
    }
}

pub fn mask_token(token: &str) -> String {
    let suffix: String = token
        .chars()
        .rev()
        .take(6)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    format!("projectus_****{suffix}")
}

fn validate_token(token: String) -> Result<String> {
    let token = token.trim().to_owned();
    if token.len() < 24 {
        bail!("token do PROJECTUS-SERVER precisa ter pelo menos 24 caracteres");
    }
    Ok(token)
}

fn generate_token() -> String {
    let secret: String = rand::rng()
        .sample_iter(&Alphanumeric)
        .take(48)
        .map(char::from)
        .collect();
    format!("projectus_{secret}")
}
