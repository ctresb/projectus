use anyhow::Result;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("projectus_server=info,tower_http=info")),
        )
        .init();
    let token = projectus_server::server_auth::token_from_headless_args()?;
    projectus_server::run(projectus_server::RunOptions::headless(token)).await
}
