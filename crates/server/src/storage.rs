use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use chrono::Utc;
use serde::{Serialize, de::DeserializeOwned};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use slug::slugify;
use thiserror::Error;
use tokio::sync::broadcast;
use url::Url;

use crate::domain::*;

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("recurso alterado em outro cliente; recarregue antes de salvar")]
    Conflict,
    #[error("recurso não encontrado")]
    NotFound,
    #[error("{0}")]
    Validation(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
}

pub type StoreResult<T> = Result<T, StoreError>;

pub struct Storage {
    root: PathBuf,
    writes: Mutex<()>,
    events: broadcast::Sender<LiveEvent>,
}

impl Storage {
    pub fn open_default() -> StoreResult<Self> {
        let root = std::env::var_os("PROJECTUS_ROOT")
            .map(PathBuf::from)
            .or_else(|| dirs::document_dir().map(|path| path.join("PROJECTUS")))
            .ok_or_else(|| {
                StoreError::Validation("não foi possível localizar Documentos".into())
            })?;
        Self::open(root)
    }

    pub fn open(root: PathBuf) -> StoreResult<Self> {
        let (events, _) = broadcast::channel(128);
        let store = Self {
            root,
            writes: Mutex::new(()),
            events,
        };
        store.initialize()?;
        Ok(store)
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn subscribe(&self) -> broadcast::Receiver<LiveEvent> {
        self.events.subscribe()
    }

    pub fn initialize(&self) -> StoreResult<()> {
        fs::create_dir_all(self.root.join("projetos"))?;
        fs::create_dir_all(self.root.join("ideias"))?;
        fs::create_dir_all(self.root.join("lixeira"))?;
        write_default(&self.root.join("config.json"), &Config::default())?;
        write_default(&self.root.join("board.json"), &Board::default())?;
        write_default(&self.root.join("history.json"), &HistoryLog::default())?;
        write_default(
            &self.root.join("ideias").join("ideas.json"),
            &IdeasIndex::default(),
        )?;
        Ok(())
    }

    pub fn bootstrap(&self) -> StoreResult<Bootstrap> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        Ok(Bootstrap {
            config: self.read_config_inner()?,
            board: self.read_board_inner()?,
            ideias: self.read_ideas_inner()?,
        })
    }

    pub fn config(&self) -> StoreResult<Config> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        self.read_config_inner()
    }

    pub fn update_config(&self, mut update: Config) -> StoreResult<Config> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        let current = self.read_config_inner()?;
        ensure_revision(current.revision, update.revision)?;
        if update.porta == 0 {
            return Err(StoreError::Validation("porta inválida".into()));
        }
        validate_columns(&update.colunas)?;
        validate_tags(&update.tags)?;
        let first_status = first_column(&update.colunas);
        let statuses: Vec<&str> = update
            .colunas
            .iter()
            .map(|column| column.id.as_str())
            .collect();
        let mut board = self.read_board_inner()?;
        let mut board_changed = false;
        for card in &mut board.projetos {
            if !statuses.contains(&card.status.as_str()) {
                card.status.clone_from(&first_status);
                card.atualizado_em = Utc::now();
                board_changed = true;
            }
        }
        if board_changed {
            board.revision += 1;
            atomic_json(&self.root.join("board.json"), &board)?;
        }
        update.revision += 1;
        update.schema_version = SCHEMA_VERSION;
        atomic_json(&self.root.join("config.json"), &update)?;
        self.history_inner(
            "config_atualizada",
            "config",
            "config",
            Some(json!({"revision": current.revision})),
            Some(json!({"revision": update.revision})),
            None,
            None,
        )?;
        self.emit("config_atualizada", "config", "config");
        Ok(update)
    }

    pub fn mark_r2_configured(&self, configured: bool) -> StoreResult<Config> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        let mut config = self.read_config_inner()?;
        config.r2.configurado = configured;
        config.revision += 1;
        atomic_json(&self.root.join("config.json"), &config)?;
        self.emit("r2_configurado", "config", "config");
        Ok(config)
    }

    pub fn record_snapshot(&self, record: &SnapshotRecord) -> StoreResult<()> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        let mut config = self.read_config_inner()?;
        config.r2.ultimo_snapshot_em = Some(record.timestamp);
        config.revision += 1;
        atomic_json(&self.root.join("config.json"), &config)?;
        self.history_inner(
            "backup_r2_criado",
            "backup",
            &record.id,
            None,
            Some(serde_json::to_value(record)?),
            None,
            None,
        )?;
        self.emit("backup_r2_criado", "backup", &record.id);
        Ok(())
    }

    pub fn history(&self) -> StoreResult<HistoryLog> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        read_json(&self.root.join("history.json"))
    }

    pub fn project(&self, id: &str) -> StoreResult<DocumentResponse<Project>> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        self.project_inner(id)
    }

    pub fn create_project(&self, input: CreateProject) -> StoreResult<DocumentResponse<Project>> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        validate_title(&input.titulo)?;
        validate_github(&input.github_url)?;
        let mut board = self.read_board_inner()?;
        let config = self.read_config_inner()?;
        let now = Utc::now();
        let id = id8();
        let folder = stable_folder(&input.titulo, &id);
        let dir = self.root.join("projetos").join(&folder);
        fs::create_dir_all(dir.join("_anexos"))?;
        fs::create_dir_all(dir.join("tarefas"))?;
        let mut tags_disponiveis = config.tags.clone();
        for tag in &input.novas_tags {
            if !tags_disponiveis.iter().any(|existing| existing.id == tag.id) {
                tags_disponiveis.push(tag.clone());
            }
        }
        let project = Project {
            revision: 1,
            id: id.clone(),
            pasta: folder.clone(),
            titulo: input.titulo.trim().to_owned(),
            github_url: input.github_url.trim().to_owned(),
            colunas: config.colunas,
            tags_disponiveis,
            tarefas: Vec::new(),
            criado_em: now,
            atualizado_em: now,
        };
        let markdown = markdown_with_title(&project.titulo, &input.markdown);
        atomic_json(&dir.join("project.json"), &project)?;
        atomic_text(&dir.join("project.md"), &markdown)?;
        atomic_json(&dir.join("history.json"), &HistoryLog::default())?;
        board.projetos.push(ProjectCard {
            id: id.clone(),
            pasta: folder,
            titulo: project.titulo.clone(),
            github_url: project.github_url.clone(),
            status: first_column(&project.colunas),
            cor: input.cor.unwrap_or_else(config_default_color),
            tags: filter_tags(input.tags, &project.tags_disponiveis),
            criado_em: now,
            atualizado_em: now,
        });
        board.revision += 1;
        atomic_json(&self.root.join("board.json"), &board)?;
        self.history_inner(
            "projeto_criado",
            "projeto",
            &id,
            None,
            Some(json!({"titulo": project.titulo, "status": first_column(&project.colunas)})),
            Some(hash_text(&markdown)),
            None,
        )?;
        self.emit("projeto_criado", "projeto", &id);
        Ok(DocumentResponse {
            dados: project,
            markdown,
        })
    }

    pub fn update_project(
        &self,
        id: &str,
        input: UpdateProject,
    ) -> StoreResult<DocumentResponse<Project>> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        validate_title(&input.titulo)?;
        validate_github(&input.github_url)?;
        let current = self.project_inner(id)?;
        ensure_revision(current.dados.revision, input.revision)?;
        let mut project = current.dados;
        project.titulo = input.titulo.trim().to_owned();
        project.github_url = input.github_url.trim().to_owned();
        if let Some(columns) = input.colunas {
            validate_columns(&columns)?;
            let first_status = first_column(&columns);
            let statuses: Vec<&str> = columns.iter().map(|column| column.id.as_str()).collect();
            for task in &mut project.tarefas {
                if !statuses.contains(&task.status.as_str()) {
                    task.status.clone_from(&first_status);
                }
            }
            project.colunas = columns;
        }
        if let Some(tags) = input.tags_disponiveis {
            validate_tags(&tags)?;
            for task in &mut project.tarefas {
                task.tags = filter_tags(std::mem::take(&mut task.tags), &tags);
            }
            project.tags_disponiveis = tags;
        }
        project.revision += 1;
        project.atualizado_em = Utc::now();
        let markdown = markdown_with_title(&project.titulo, &input.markdown);
        let dir = self.root.join("projetos").join(&project.pasta);
        atomic_json(&dir.join("project.json"), &project)?;
        atomic_text(&dir.join("project.md"), &markdown)?;
        let mut board = self.read_board_inner()?;
        if let Some(card) = board.projetos.iter_mut().find(|card| card.id == id) {
            card.titulo.clone_from(&project.titulo);
            card.github_url.clone_from(&project.github_url);
            card.cor = input.cor;
            card.tags = input.tags;
            card.atualizado_em = project.atualizado_em;
        }
        board.revision += 1;
        atomic_json(&self.root.join("board.json"), &board)?;
        self.history_inner(
            "projeto_editado",
            "projeto",
            id,
            Some(json!({"revision": input.revision})),
            Some(json!({"revision": project.revision, "titulo": project.titulo})),
            Some(hash_text(&markdown)),
            Some(&dir),
        )?;
        self.emit("projeto_editado", "projeto", id);
        Ok(DocumentResponse {
            dados: project,
            markdown,
        })
    }

    pub fn delete_project(&self, id: &str, revision: u64) -> StoreResult<Board> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        let mut board = self.read_board_inner()?;
        ensure_revision(board.revision, revision)?;
        let index = board
            .projetos
            .iter()
            .position(|card| card.id == id)
            .ok_or(StoreError::NotFound)?;
        let card = board.projetos.remove(index);
        let source = self.root.join("projetos").join(&card.pasta);
        let target =
            self.root
                .join("lixeira")
                .join(format!("{}-{}", card.pasta, Utc::now().timestamp()));
        fs::rename(source, target)?;
        board.revision += 1;
        atomic_json(&self.root.join("board.json"), &board)?;
        self.history_inner(
            "projeto_arquivado",
            "projeto",
            id,
            Some(json!(card)),
            None,
            None,
            None,
        )?;
        self.emit("projeto_arquivado", "projeto", id);
        Ok(board)
    }

    pub fn move_project(&self, input: MoveItem) -> StoreResult<Board> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        let mut board = self.read_board_inner()?;
        ensure_revision(board.revision, input.revision)?;
        let position = board
            .projetos
            .iter()
            .position(|card| card.id == input.id)
            .ok_or(StoreError::NotFound)?;
        let mut card = board.projetos.remove(position);
        let previous = card.status.clone();
        card.status.clone_from(&input.status);
        card.atualizado_em = Utc::now();
        let target_index = column_insert_index(&board.projetos, &input.status, input.indice);
        board.projetos.insert(target_index, card);
        board.revision += 1;
        atomic_json(&self.root.join("board.json"), &board)?;
        self.history_inner(
            "projeto_movido",
            "projeto",
            &input.id,
            Some(json!({"status": previous})),
            Some(json!({"status": input.status, "indice": input.indice})),
            None,
            None,
        )?;
        self.emit("projeto_movido", "projeto", &input.id);
        Ok(board)
    }

    pub fn create_task(
        &self,
        project_id: &str,
        input: CreateTask,
    ) -> StoreResult<DocumentResponse<Project>> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        validate_title(&input.titulo)?;
        let current = self.project_inner(project_id)?;
        ensure_revision(current.dados.revision, input.revision)?;
        let mut project = current.dados;
        let mut tag_catalog = project.tags_disponiveis.clone();
        for new_tag in input.novas_tags {
            if !tag_catalog.iter().any(|tag| tag.id == new_tag.id) {
                tag_catalog.push(new_tag);
            }
        }
        validate_tags(&tag_catalog)?;
        project.tags_disponiveis = tag_catalog;
        let now = Utc::now();
        let id = id8();
        let folder = stable_folder(&input.titulo, &id);
        let task_dir = self
            .root
            .join("projetos")
            .join(&project.pasta)
            .join("tarefas")
            .join(&folder);
        fs::create_dir_all(&task_dir)?;
        let markdown = markdown_with_title(&input.titulo, &input.markdown);
        atomic_text(&task_dir.join("card.md"), &markdown)?;
        project.tarefas.push(TaskCard {
            id: id.clone(),
            pasta: folder,
            titulo: input.titulo.trim().to_owned(),
            status: first_column(&project.colunas),
            cor: input.cor.unwrap_or_else(config_default_color),
            tags: filter_tags(input.tags, &project.tags_disponiveis),
            criado_em: now,
            atualizado_em: now,
        });
        project.revision += 1;
        project.atualizado_em = now;
        let dir = self.root.join("projetos").join(&project.pasta);
        atomic_json(&dir.join("project.json"), &project)?;
        self.history_inner(
            "tarefa_criada",
            "tarefa",
            &id,
            None,
            Some(json!({"titulo": input.titulo})),
            Some(hash_text(&markdown)),
            Some(&dir),
        )?;
        self.emit("tarefa_criada", "tarefa", &id);
        Ok(DocumentResponse {
            dados: project,
            markdown: current.markdown,
        })
    }

    pub fn task_markdown(&self, project_id: &str, task_id: &str) -> StoreResult<String> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        let project = self.project_inner(project_id)?.dados;
        let task = project
            .tarefas
            .iter()
            .find(|task| task.id == task_id)
            .ok_or(StoreError::NotFound)?;
        Ok(fs::read_to_string(
            self.root
                .join("projetos")
                .join(project.pasta)
                .join("tarefas")
                .join(&task.pasta)
                .join("card.md"),
        )?)
    }

    pub fn update_task(
        &self,
        project_id: &str,
        task_id: &str,
        input: UpdateTask,
    ) -> StoreResult<Project> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        validate_title(&input.titulo)?;
        let current = self.project_inner(project_id)?;
        ensure_revision(current.dados.revision, input.revision)?;
        let mut project = current.dados;
        let task = project
            .tarefas
            .iter_mut()
            .find(|task| task.id == task_id)
            .ok_or(StoreError::NotFound)?;
        task.titulo = input.titulo.trim().to_owned();
        task.cor = input.cor;
        task.tags = input.tags;
        task.atualizado_em = Utc::now();
        let markdown = markdown_with_title(&task.titulo, &input.markdown);
        let dir = self.root.join("projetos").join(&project.pasta);
        atomic_text(
            &dir.join("tarefas").join(&task.pasta).join("card.md"),
            &markdown,
        )?;
        project.revision += 1;
        project.atualizado_em = Utc::now();
        atomic_json(&dir.join("project.json"), &project)?;
        self.history_inner(
            "tarefa_editada",
            "tarefa",
            task_id,
            None,
            Some(json!({"titulo": input.titulo, "revision": project.revision})),
            Some(hash_text(&markdown)),
            Some(&dir),
        )?;
        self.emit("tarefa_editada", "tarefa", task_id);
        Ok(project)
    }

    pub fn move_task(&self, project_id: &str, input: MoveItem) -> StoreResult<Project> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        let current = self.project_inner(project_id)?;
        ensure_revision(current.dados.revision, input.revision)?;
        let mut project = current.dados;
        let pos = project
            .tarefas
            .iter()
            .position(|task| task.id == input.id)
            .ok_or(StoreError::NotFound)?;
        let mut task = project.tarefas.remove(pos);
        let previous = task.status.clone();
        task.status.clone_from(&input.status);
        task.atualizado_em = Utc::now();
        let insert = task_insert_index(&project.tarefas, &input.status, input.indice);
        project.tarefas.insert(insert, task);
        project.revision += 1;
        project.atualizado_em = Utc::now();
        let dir = self.root.join("projetos").join(&project.pasta);
        atomic_json(&dir.join("project.json"), &project)?;
        self.history_inner(
            "tarefa_movida",
            "tarefa",
            &input.id,
            Some(json!({"status": previous})),
            Some(json!({"status": input.status, "indice": input.indice})),
            None,
            Some(&dir),
        )?;
        self.emit("tarefa_movida", "tarefa", &input.id);
        Ok(project)
    }

    pub fn delete_task(
        &self,
        project_id: &str,
        task_id: &str,
        revision: u64,
    ) -> StoreResult<Project> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        let current = self.project_inner(project_id)?;
        ensure_revision(current.dados.revision, revision)?;
        let mut project = current.dados;
        let pos = project
            .tarefas
            .iter()
            .position(|task| task.id == task_id)
            .ok_or(StoreError::NotFound)?;
        let task = project.tarefas.remove(pos);
        let dir = self.root.join("projetos").join(&project.pasta);
        let source = dir.join("tarefas").join(&task.pasta);
        let target =
            self.root
                .join("lixeira")
                .join(format!("{}-{}", task.pasta, Utc::now().timestamp()));
        fs::rename(source, target)?;
        project.revision += 1;
        atomic_json(&dir.join("project.json"), &project)?;
        self.history_inner(
            "tarefa_arquivada",
            "tarefa",
            task_id,
            Some(json!(task)),
            None,
            None,
            Some(&dir),
        )?;
        self.emit("tarefa_arquivada", "tarefa", task_id);
        Ok(project)
    }

    pub fn ideas(&self) -> StoreResult<IdeasIndex> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        self.read_ideas_inner()
    }

    pub fn idea(&self, id: &str) -> StoreResult<DocumentResponse<IdeaCard>> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        let ideas = self.read_ideas_inner()?;
        let idea = ideas
            .notas
            .into_iter()
            .find(|idea| idea.id == id)
            .ok_or(StoreError::NotFound)?;
        let markdown =
            fs::read_to_string(self.root.join("ideias").join(&idea.pasta).join("note.md"))?;
        Ok(DocumentResponse {
            dados: idea,
            markdown,
        })
    }

    pub fn create_idea(&self, input: CreateIdea) -> StoreResult<DocumentResponse<IdeaCard>> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        validate_title(&input.titulo)?;
        let mut ideas = self.read_ideas_inner()?;
        let id = id8();
        let folder = stable_folder(&input.titulo, &id);
        let now = Utc::now();
        let idea = IdeaCard {
            id: id.clone(),
            pasta: folder.clone(),
            titulo: input.titulo.trim().to_owned(),
            cor: config_default_color(),
            criado_em: now,
            atualizado_em: now,
        };
        let markdown = markdown_with_title(&idea.titulo, &input.markdown);
        fs::create_dir_all(self.root.join("ideias").join(&folder))?;
        atomic_text(
            &self.root.join("ideias").join(&folder).join("note.md"),
            &markdown,
        )?;
        ideas.notas.insert(0, idea.clone());
        ideas.revision += 1;
        atomic_json(&self.root.join("ideias").join("ideas.json"), &ideas)?;
        self.history_inner(
            "ideia_criada",
            "ideia",
            &id,
            None,
            Some(json!(idea)),
            Some(hash_text(&markdown)),
            None,
        )?;
        self.emit("ideia_criada", "ideia", &id);
        Ok(DocumentResponse {
            dados: idea,
            markdown,
        })
    }

    pub fn update_idea(
        &self,
        id: &str,
        input: UpdateIdea,
    ) -> StoreResult<DocumentResponse<IdeaCard>> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        validate_title(&input.titulo)?;
        let mut ideas = self.read_ideas_inner()?;
        ensure_revision(ideas.revision, input.revision)?;
        let idea = ideas
            .notas
            .iter_mut()
            .find(|idea| idea.id == id)
            .ok_or(StoreError::NotFound)?;
        idea.titulo = input.titulo.trim().to_owned();
        idea.cor = input.cor;
        idea.atualizado_em = Utc::now();
        let updated = idea.clone();
        let markdown = markdown_with_title(&updated.titulo, &input.markdown);
        atomic_text(
            &self
                .root
                .join("ideias")
                .join(&updated.pasta)
                .join("note.md"),
            &markdown,
        )?;
        ideas.revision += 1;
        atomic_json(&self.root.join("ideias").join("ideas.json"), &ideas)?;
        self.history_inner(
            "ideia_editada",
            "ideia",
            id,
            None,
            Some(json!(updated)),
            Some(hash_text(&markdown)),
            None,
        )?;
        self.emit("ideia_editada", "ideia", id);
        Ok(DocumentResponse {
            dados: updated,
            markdown,
        })
    }

    pub fn delete_idea(&self, id: &str, revision: u64) -> StoreResult<IdeasIndex> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        let mut ideas = self.read_ideas_inner()?;
        ensure_revision(ideas.revision, revision)?;
        let pos = ideas
            .notas
            .iter()
            .position(|idea| idea.id == id)
            .ok_or(StoreError::NotFound)?;
        let idea = ideas.notas.remove(pos);
        let source = self.root.join("ideias").join(&idea.pasta);
        let lixeira = self.root.join("lixeira");
        fs::create_dir_all(&lixeira)?;
        let base = format!("{}-{}", idea.pasta, Utc::now().timestamp());
        let mut target = lixeira.join(&base);
        let mut suffix = 0u32;
        while target.exists() {
            suffix += 1;
            target = lixeira.join(format!("{base}-{suffix}"));
        }
        if !source.exists() {
            ideas.revision += 1;
            atomic_json(&self.root.join("ideias").join("ideas.json"), &ideas)?;
            self.emit("ideia_arquivada", "ideia", id);
            return Ok(ideas);
        }
        fs::rename(&source, &target).map_err(|err| {
            StoreError::Validation(format!(
                "não foi possível mover a ideia para a lixeira: {err}"
            ))
        })?;
        ideas.revision += 1;
        atomic_json(&self.root.join("ideias").join("ideas.json"), &ideas)?;
        self.history_inner(
            "ideia_arquivada",
            "ideia",
            id,
            Some(json!(idea)),
            None,
            None,
            None,
        )?;
        self.emit("ideia_arquivada", "ideia", id);
        Ok(ideas)
    }

    pub fn save_project_attachment(
        &self,
        project_id: &str,
        file_name: &str,
        bytes: &[u8],
    ) -> StoreResult<String> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        let project = self.project_inner(project_id)?.dados;
        let saved = safe_attachment_name(file_name);
        let relative = PathBuf::from("projetos")
            .join(&project.pasta)
            .join("_anexos")
            .join(saved);
        atomic_bytes(&self.root.join(&relative), bytes)?;
        self.emit("anexo_salvo", "projeto", project_id);
        Ok(format!("/conteudo/{}", relative.to_string_lossy()))
    }

    pub fn save_task_attachment(
        &self,
        project_id: &str,
        task_id: &str,
        file_name: &str,
        bytes: &[u8],
    ) -> StoreResult<String> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        let project = self.project_inner(project_id)?.dados;
        let task = project
            .tarefas
            .iter()
            .find(|task| task.id == task_id)
            .ok_or(StoreError::NotFound)?;
        let relative = PathBuf::from("projetos")
            .join(project.pasta)
            .join("tarefas")
            .join(&task.pasta)
            .join(safe_attachment_name(file_name));
        atomic_bytes(&self.root.join(&relative), bytes)?;
        self.emit("anexo_salvo", "tarefa", task_id);
        Ok(format!("/conteudo/{}", relative.to_string_lossy()))
    }

    pub fn save_idea_attachment(
        &self,
        id: &str,
        file_name: &str,
        bytes: &[u8],
    ) -> StoreResult<String> {
        let _guard = self.writes.lock().expect("storage mutex poisoned");
        let ideas = self.read_ideas_inner()?;
        let idea = ideas
            .notas
            .iter()
            .find(|idea| idea.id == id)
            .ok_or(StoreError::NotFound)?;
        let relative = PathBuf::from("ideias")
            .join(&idea.pasta)
            .join(safe_attachment_name(file_name));
        atomic_bytes(&self.root.join(&relative), bytes)?;
        self.emit("anexo_salvo", "ideia", id);
        Ok(format!("/conteudo/{}", relative.to_string_lossy()))
    }

    fn read_config_inner(&self) -> StoreResult<Config> {
        let mut config: Config = read_json(&self.root.join("config.json"))?;
        if config.cores.iter().any(|color| color.id == "lilas") {
            config.cores = default_colors();
        }
        Ok(config)
    }

    fn read_board_inner(&self) -> StoreResult<Board> {
        read_json(&self.root.join("board.json"))
    }

    fn read_ideas_inner(&self) -> StoreResult<IdeasIndex> {
        read_json(&self.root.join("ideias").join("ideas.json"))
    }

    fn project_inner(&self, id: &str) -> StoreResult<DocumentResponse<Project>> {
        let board = self.read_board_inner()?;
        let card = board
            .projetos
            .iter()
            .find(|card| card.id == id)
            .ok_or(StoreError::NotFound)?;
        let dir = self.root.join("projetos").join(&card.pasta);
        Ok(DocumentResponse {
            dados: read_json(&dir.join("project.json"))?,
            markdown: fs::read_to_string(dir.join("project.md"))?,
        })
    }

    fn history_inner(
        &self,
        kind: &str,
        entity: &str,
        entity_id: &str,
        before: Option<Value>,
        after: Option<Value>,
        content_hash: Option<String>,
        project_dir: Option<&Path>,
    ) -> StoreResult<()> {
        let event = HistoryEvent {
            id: id8(),
            timestamp: Utc::now(),
            tipo: kind.to_owned(),
            entidade: entity.to_owned(),
            entidade_id: entity_id.to_owned(),
            antes: before,
            depois: after,
            content_hash,
        };
        append_history(&self.root.join("history.json"), event.clone())?;
        if let Some(dir) = project_dir {
            append_history(&dir.join("history.json"), event)?;
        }
        Ok(())
    }

    pub(crate) fn emit(&self, kind: &str, entity: &str, id: &str) {
        let _ = self.events.send(LiveEvent {
            tipo: kind.to_owned(),
            entidade: entity.to_owned(),
            entidade_id: id.to_owned(),
            timestamp: Utc::now(),
        });
    }
}

fn validate_title(title: &str) -> StoreResult<()> {
    if title.trim().is_empty() {
        Err(StoreError::Validation("o título é obrigatório".into()))
    } else {
        Ok(())
    }
}

fn validate_columns(columns: &[Column]) -> StoreResult<()> {
    if columns.is_empty() {
        return Err(StoreError::Validation("crie pelo menos uma coluna".into()));
    }
    for (index, column) in columns.iter().enumerate() {
        if column.id.trim().is_empty() || column.titulo.trim().is_empty() {
            return Err(StoreError::Validation("toda coluna precisa de nome".into()));
        }
        if columns[..index].iter().any(|other| other.id == column.id) {
            return Err(StoreError::Validation(
                "IDs de colunas devem ser únicos".into(),
            ));
        }
    }
    Ok(())
}

fn validate_tags(tags: &[Tag]) -> StoreResult<()> {
    for (index, tag) in tags.iter().enumerate() {
        if tag.id.trim().is_empty() || tag.titulo.trim().is_empty() {
            return Err(StoreError::Validation("toda tag precisa de nome".into()));
        }
        if tags[..index].iter().any(|other| other.id == tag.id) {
            return Err(StoreError::Validation(
                "IDs de tags devem ser únicos".into(),
            ));
        }
    }
    Ok(())
}

fn filter_tags(tags: Vec<String>, available: &[Tag]) -> Vec<String> {
    tags.into_iter()
        .filter(|id| available.iter().any(|tag| &tag.id == id))
        .collect()
}

fn validate_github(raw: &str) -> StoreResult<()> {
    let parsed = Url::parse(raw)
        .map_err(|_| StoreError::Validation("informe uma URL válida do GitHub".into()))?;
    let segments: Vec<_> = parsed
        .path_segments()
        .map(|s| s.filter(|part| !part.is_empty()).collect())
        .unwrap_or_default();
    if parsed.scheme() != "https" || parsed.host_str() != Some("github.com") || segments.len() < 2 {
        return Err(StoreError::Validation(
            "use uma URL https://github.com/dono/repositorio".into(),
        ));
    }
    Ok(())
}

fn ensure_revision(current: u64, given: u64) -> StoreResult<()> {
    if current != given {
        Err(StoreError::Conflict)
    } else {
        Ok(())
    }
}

fn stable_folder(title: &str, id: &str) -> String {
    let slug = slugify(title);
    format!("{}-{}", if slug.is_empty() { "item" } else { &slug }, id)
}

fn markdown_with_title(title: &str, markdown: &str) -> String {
    let trimmed = markdown.trim_start();
    let body = if trimmed.starts_with("# ") {
        trimmed
            .split_once('\n')
            .map(|(_, body)| body.trim_start())
            .unwrap_or("")
    } else {
        trimmed
    };
    if body.trim().is_empty() {
        format!("# {}\n", title.trim())
    } else {
        format!("# {}\n\n{}\n", title.trim(), body.trim_end())
    }
}

fn hash_text(text: &str) -> String {
    hex::encode(Sha256::digest(text.as_bytes()))
}

fn first_column(columns: &[Column]) -> String {
    columns
        .first()
        .map(|column| column.id.clone())
        .unwrap_or_else(|| "planejado".into())
}

fn config_default_color() -> String {
    "#55B9F7".to_owned()
}

fn column_insert_index(cards: &[ProjectCard], status: &str, requested: usize) -> usize {
    let matching: Vec<usize> = cards
        .iter()
        .enumerate()
        .filter_map(|(idx, card)| (card.status == status).then_some(idx))
        .collect();
    if requested >= matching.len() {
        matching.last().map(|idx| idx + 1).unwrap_or(cards.len())
    } else {
        matching[requested]
    }
}

fn task_insert_index(cards: &[TaskCard], status: &str, requested: usize) -> usize {
    let matching: Vec<usize> = cards
        .iter()
        .enumerate()
        .filter_map(|(idx, card)| (card.status == status).then_some(idx))
        .collect();
    if requested >= matching.len() {
        matching.last().map(|idx| idx + 1).unwrap_or(cards.len())
    } else {
        matching[requested]
    }
}

fn safe_attachment_name(original: &str) -> String {
    let path = Path::new(original);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("arquivo");
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("bin");
    format!("{}-{}.{}", slugify(stem), id8(), ext.to_ascii_lowercase())
}

fn append_history(path: &Path, event: HistoryEvent) -> StoreResult<()> {
    let mut history: HistoryLog = read_json(path)?;
    history.eventos.push(event);
    history.revision += 1;
    atomic_json(path, &history)?;
    Ok(())
}

fn write_default<T: Serialize>(path: &Path, value: &T) -> StoreResult<()> {
    if !path.exists() {
        atomic_json(path, value)?;
    }
    Ok(())
}

pub fn read_json<T: DeserializeOwned>(path: &Path) -> StoreResult<T> {
    Ok(serde_json::from_slice(&fs::read(path)?)?)
}

pub fn atomic_json<T: Serialize>(path: &Path, value: &T) -> StoreResult<()> {
    atomic_bytes(path, &serde_json::to_vec_pretty(value)?)
}

pub fn atomic_text(path: &Path, text: &str) -> StoreResult<()> {
    atomic_bytes(path, text.as_bytes())
}

pub fn atomic_bytes(path: &Path, bytes: &[u8]) -> StoreResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let temp = path.with_extension(format!("tmp-{}", id8()));
    fs::write(&temp, bytes)?;
    fs::rename(temp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use tempfile::TempDir;

    use super::*;

    fn store() -> (TempDir, Storage) {
        let dir = tempfile::tempdir().unwrap();
        let storage = Storage::open(dir.path().join("PROJECTUS")).unwrap();
        (dir, storage)
    }

    #[test]
    fn creates_files_and_stable_project_folder() {
        let (_dir, store) = store();
        let project = store
            .create_project(CreateProject {
                titulo: "Fazer jogo legal".into(),
                github_url: "https://github.com/eu/jogo".into(),
                markdown: "Uma descrição".into(),
                cor: None,
                tags: Vec::new(),
                novas_tags: Vec::new(),
            })
            .unwrap();
        assert!(project.dados.pasta.starts_with("fazer-jogo-legal-"));
        assert!(
            store
                .root()
                .join("projetos")
                .join(project.dados.pasta)
                .join("project.md")
                .exists()
        );
    }

    #[test]
    fn initializes_r2_region_for_cloudflare() {
        let (_dir, store) = store();
        assert_eq!(store.config().unwrap().r2.region, "auto");
    }

    #[test]
    fn rejects_invalid_github_repository() {
        let (_dir, store) = store();
        let error = store
            .create_project(CreateProject {
                titulo: "Falha".into(),
                github_url: "https://example.com/nope".into(),
                markdown: String::new(),
                cor: None,
                tags: Vec::new(),
                novas_tags: Vec::new(),
            })
            .unwrap_err();
        assert!(matches!(error, StoreError::Validation(_)));
    }

    #[test]
    fn refuses_stale_moves() {
        let (_dir, store) = store();
        let project = store
            .create_project(CreateProject {
                titulo: "Projeto".into(),
                github_url: "https://github.com/eu/projeto".into(),
                markdown: String::new(),
                cor: None,
                tags: Vec::new(),
                novas_tags: Vec::new(),
            })
            .unwrap();
        let board = store.bootstrap().unwrap().board;
        store
            .move_project(MoveItem {
                revision: board.revision,
                id: project.dados.id.clone(),
                status: "fazendo".into(),
                indice: 0,
            })
            .unwrap();
        assert!(matches!(
            store.move_project(MoveItem {
                revision: board.revision,
                id: project.dados.id,
                status: "pronto".into(),
                indice: 0,
            }),
            Err(StoreError::Conflict)
        ));
    }

    #[test]
    fn rehomes_projects_when_a_global_column_is_removed() {
        let (_dir, store) = store();
        let project = store
            .create_project(CreateProject {
                titulo: "Projeto".into(),
                github_url: "https://github.com/eu/projeto".into(),
                markdown: String::new(),
                cor: None,
                tags: Vec::new(),
                novas_tags: Vec::new(),
            })
            .unwrap();
        let board = store.bootstrap().unwrap().board;
        store
            .move_project(MoveItem {
                revision: board.revision,
                id: project.dados.id,
                status: "fazendo".into(),
                indice: 0,
            })
            .unwrap();
        let mut config = store.config().unwrap();
        config.colunas.retain(|column| column.id != "fazendo");
        store.update_config(config).unwrap();
        assert_eq!(
            store.bootstrap().unwrap().board.projetos[0].status,
            "planejado"
        );
    }

    #[test]
    fn creates_task_with_a_new_project_tag_in_one_operation() {
        let (_dir, store) = store();
        let project = store
            .create_project(CreateProject {
                titulo: "Projeto".into(),
                github_url: "https://github.com/eu/projeto".into(),
                markdown: String::new(),
                cor: None,
                tags: Vec::new(),
                novas_tags: Vec::new(),
            })
            .unwrap();
        let updated = store
            .create_task(
                &project.dados.id,
                CreateTask {
                    revision: project.dados.revision,
                    titulo: "Primeira tarefa".into(),
                    markdown: "- [ ] pronto".into(),
                    cor: Some("#FE3867".into()),
                    tags: vec!["tag-bug".into()],
                    novas_tags: vec![Tag {
                        id: "tag-bug".into(),
                        titulo: "bug".into(),
                        cor: "#FE3867".into(),
                    }],
                },
            )
            .unwrap();
        assert_eq!(updated.dados.tags_disponiveis[0].titulo, "bug");
        assert_eq!(updated.dados.tarefas[0].tags, vec!["tag-bug"]);
    }

    #[test]
    fn archives_an_idea_instead_of_deleting_its_folder() {
        let (_dir, store) = store();
        let idea = store
            .create_idea(CreateIdea {
                titulo: "Pista".into(),
                markdown: String::new(),
            })
            .unwrap();
        let ideas = store.ideas().unwrap();
        let archived = store.delete_idea(&idea.dados.id, ideas.revision).unwrap();
        assert!(archived.notas.is_empty());
        assert!(
            store
                .root()
                .join("lixeira")
                .read_dir()
                .unwrap()
                .next()
                .is_some()
        );
    }
}
