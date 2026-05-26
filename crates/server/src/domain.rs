use chrono::{DateTime, Utc};
use rand::{Rng, distr::Alphanumeric};
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Column {
    pub id: String,
    pub titulo: String,
    pub cor: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub titulo: String,
    pub cor: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorChoice {
    pub id: String,
    pub titulo: String,
    pub valor: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct R2Config {
    pub endpoint: String,
    pub bucket: String,
    #[serde(default = "default_region")]
    pub region: String,
    #[serde(default)]
    pub configurado: bool,
    pub ultimo_snapshot_em: Option<DateTime<Utc>>,
}

impl Default for R2Config {
    fn default() -> Self {
        Self {
            endpoint: String::new(),
            bucket: String::new(),
            region: default_region(),
            configurado: false,
            ultimo_snapshot_em: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub schema_version: u32,
    pub revision: u64,
    pub porta: u16,
    pub colunas: Vec<Column>,
    pub tags: Vec<Tag>,
    pub cores: Vec<ColorChoice>,
    pub r2: R2Config,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Board {
    pub revision: u64,
    pub projetos: Vec<ProjectCard>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectCard {
    pub id: String,
    pub pasta: String,
    pub titulo: String,
    pub github_url: String,
    pub status: String,
    pub cor: String,
    pub tags: Vec<String>,
    pub criado_em: DateTime<Utc>,
    pub atualizado_em: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub revision: u64,
    pub id: String,
    pub pasta: String,
    pub titulo: String,
    pub github_url: String,
    pub colunas: Vec<Column>,
    pub tags_disponiveis: Vec<Tag>,
    pub tarefas: Vec<TaskCard>,
    pub criado_em: DateTime<Utc>,
    pub atualizado_em: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskCard {
    pub id: String,
    pub pasta: String,
    pub titulo: String,
    pub status: String,
    pub cor: String,
    pub tags: Vec<String>,
    pub criado_em: DateTime<Utc>,
    pub atualizado_em: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdeasIndex {
    pub revision: u64,
    pub notas: Vec<IdeaCard>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdeaCard {
    pub id: String,
    pub pasta: String,
    pub titulo: String,
    pub cor: String,
    pub criado_em: DateTime<Utc>,
    pub atualizado_em: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryLog {
    pub revision: u64,
    pub eventos: Vec<HistoryEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEvent {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub tipo: String,
    pub entidade: String,
    pub entidade_id: String,
    pub antes: Option<Value>,
    pub depois: Option<Value>,
    pub content_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveEvent {
    pub tipo: String,
    pub entidade: String,
    pub entidade_id: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProject {
    pub titulo: String,
    pub github_url: String,
    #[serde(default)]
    pub markdown: String,
    #[serde(default)]
    pub cor: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProject {
    pub revision: u64,
    pub titulo: String,
    pub github_url: String,
    pub markdown: String,
    pub cor: String,
    pub tags: Vec<String>,
    #[serde(default)]
    pub colunas: Option<Vec<Column>>,
    #[serde(default)]
    pub tags_disponiveis: Option<Vec<Tag>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveItem {
    pub revision: u64,
    pub id: String,
    pub status: String,
    pub indice: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTask {
    pub revision: u64,
    pub titulo: String,
    #[serde(default)]
    pub markdown: String,
    #[serde(default)]
    pub cor: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub novas_tags: Vec<Tag>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTask {
    pub revision: u64,
    pub titulo: String,
    pub markdown: String,
    pub cor: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateIdea {
    pub titulo: String,
    #[serde(default)]
    pub markdown: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateIdea {
    pub revision: u64,
    pub titulo: String,
    pub markdown: String,
    pub cor: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bootstrap {
    pub config: Config,
    pub board: Board,
    pub ideias: IdeasIndex,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentResponse<T> {
    pub dados: T,
    pub markdown: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupCredentials {
    pub access_key_id: String,
    pub secret_access_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupCredentialStatus {
    pub fixadas: bool,
    pub access_key_id_mascarada: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotRequest {
    pub origem: SnapshotOrigin,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SnapshotOrigin {
    Manual,
    Automatico,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotRecord {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub origem: SnapshotOrigin,
    pub arquivos: usize,
    pub bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RemoteHistory {
    pub snapshots: Vec<SnapshotRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub origem: SnapshotOrigin,
    pub arquivos: Vec<ManifestFile>,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestFile {
    pub caminho: String,
    pub bytes: u64,
    pub sha256: String,
}

pub fn id8() -> String {
    rand::rng()
        .sample_iter(&Alphanumeric)
        .take(8)
        .map(char::from)
        .collect()
}

pub fn default_region() -> String {
    "auto".to_owned()
}

pub fn default_columns() -> Vec<Column> {
    [
        ("planejado", "PLANEJADO", "#55B9F7"),
        ("fazendo", "FAZENDO", "#FAD344"),
        ("finalizando", "FINALIZANDO", "#FE3867"),
        ("pronto", "PRONTO", "#61E141"),
        ("concluido", "CONCLUÍDO", "#B8B3A4"),
    ]
    .into_iter()
    .map(|(id, titulo, cor)| Column {
        id: id.to_owned(),
        titulo: titulo.to_owned(),
        cor: cor.to_owned(),
    })
    .collect()
}

pub fn default_colors() -> Vec<ColorChoice> {
    [
        ("azul", "Azul", "#55B9F7"),
        ("verde", "Verde", "#61E141"),
        ("rosa", "Rosa", "#FE3867"),
        ("amarelo", "Amarelo", "#FAD344"),
        ("papel", "Papel", "#F5F2EA"),
        ("papel-2", "Papel fosco", "#EDE9DE"),
        ("papel-3", "Papel antigo", "#DCD7C8"),
        ("linha", "Linha", "#C8C2B0"),
        ("texto-2", "Texto secundário", "#B8B3A4"),
        ("texto-3", "Texto terciário", "#6E6A60"),
        ("tinta-3", "Tinta elevada", "#3A3A3A"),
        ("tinta-2", "Tinta superfície", "#2A2A2A"),
    ]
    .into_iter()
    .map(|(id, titulo, valor)| ColorChoice {
        id: id.to_owned(),
        titulo: titulo.to_owned(),
        valor: valor.to_owned(),
    })
    .collect()
}

impl Default for Config {
    fn default() -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            revision: 1,
            porta: 4387,
            colunas: default_columns(),
            tags: Vec::new(),
            cores: default_colors(),
            r2: R2Config::default(),
        }
    }
}

impl Default for Board {
    fn default() -> Self {
        Self {
            revision: 1,
            projetos: Vec::new(),
        }
    }
}

impl Default for IdeasIndex {
    fn default() -> Self {
        Self {
            revision: 1,
            notas: Vec::new(),
        }
    }
}

impl Default for HistoryLog {
    fn default() -> Self {
        Self {
            revision: 1,
            eventos: Vec::new(),
        }
    }
}
