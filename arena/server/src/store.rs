use crate::{persistence::Persistence, script_worker::ScriptWorkers};
use axum::{
    Json,
    http::{HeaderMap, StatusCode},
};
use skyscraper_arena_server::Session;
use std::{collections::BTreeMap, io, path::PathBuf, sync::Arc};
use tokio::sync::{Mutex, watch};
mod ticks;

pub type Error = (StatusCode, Json<serde_json::Value>);
pub fn error(status: StatusCode, message: &str) -> Error {
    (status, Json(serde_json::json!({"error": message})))
}
struct Entry {
    session: Session,
    dirty: bool,
}
type SharedEntry = Arc<Mutex<Entry>>;

#[derive(Clone)]
pub struct Store {
    sessions: Arc<Mutex<BTreeMap<String, SharedEntry>>>,
    persistence: Arc<Persistence>,
    pub workers: ScriptWorkers,
    pub shutdown: watch::Sender<bool>,
}

fn owner(session: &Session, token: &str) -> Result<String, Error> {
    session.tokens.get(token).cloned().ok_or_else(|| {
        error(
            StatusCode::UNAUTHORIZED,
            "valid session bearer token required",
        )
    })
}
fn bearer(headers: &HeaderMap) -> &str {
    headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .unwrap_or("")
}

impl Store {
    pub fn open(directory: PathBuf) -> io::Result<Self> {
        let persistence = Persistence::open(directory)?;
        let entries = persistence.restore()?;
        println!("Restored {} arena sessions", entries.len());
        Ok(Self {
            sessions: Arc::new(Mutex::new(
                entries
                    .into_iter()
                    .map(|(id, session)| {
                        (
                            id,
                            Arc::new(Mutex::new(Entry {
                                session,
                                dirty: false,
                            })),
                        )
                    })
                    .collect(),
            )),
            persistence: Arc::new(persistence),
            workers: ScriptWorkers::default(),
            shutdown: watch::channel(false).0,
        })
    }
    pub async fn insert(&self, session: Session) {
        self.sessions.lock().await.insert(
            session.id.clone(),
            Arc::new(Mutex::new(Entry {
                session,
                dirty: true,
            })),
        );
    }
    async fn entry(&self, id: &str) -> Result<SharedEntry, Error> {
        self.sessions
            .lock()
            .await
            .get(id)
            .cloned()
            .ok_or_else(|| error(StatusCode::NOT_FOUND, "session not found"))
    }
    async fn access<T>(
        &self,
        id: &str,
        edit: bool,
        action: impl FnOnce(&mut Session) -> Result<T, Error>,
    ) -> Result<T, Error> {
        let shared = self.entry(id).await?;
        let mut entry = shared.lock().await;
        let result = action(&mut entry.session)?;
        entry.dirty |= edit;
        Ok(result)
    }
    pub async fn with_session<T>(
        &self,
        id: &str,
        action: impl FnOnce(&mut Session) -> Result<T, Error>,
    ) -> Result<T, Error> {
        self.access(id, false, action).await
    }
    pub async fn edit_session<T>(
        &self,
        id: &str,
        action: impl FnOnce(&mut Session) -> Result<T, Error>,
    ) -> Result<T, Error> {
        self.access(id, true, action).await
    }
    pub async fn with_token<T>(
        &self,
        id: &str,
        token: &str,
        action: impl FnOnce(&mut Session, &str) -> Result<T, Error>,
    ) -> Result<T, Error> {
        self.access(id, false, |session| {
            let player = owner(session, token)?;
            action(session, &player)
        })
        .await
    }
    pub async fn with_player<T>(
        &self,
        id: &str,
        headers: &HeaderMap,
        action: impl FnOnce(&mut Session, &str) -> Result<T, Error>,
    ) -> Result<T, Error> {
        self.with_token(id, bearer(headers), action).await
    }
    pub async fn edit_player<T>(
        &self,
        id: &str,
        headers: &HeaderMap,
        action: impl FnOnce(&mut Session, &str) -> Result<T, Error>,
    ) -> Result<T, Error> {
        self.access(id, true, |session| {
            let player = owner(session, bearer(headers))?;
            action(session, &player)
        })
        .await
    }
    pub async fn checkpoint(&self) -> io::Result<()> {
        let entries: Vec<_> = self.sessions.lock().await.values().cloned().collect();
        let mut failure = None;
        for shared in entries {
            let entry = shared.lock_owned().await;
            if !entry.dirty {
                continue;
            }
            let persistence = self.persistence.clone();
            let result = tokio::task::spawn_blocking(move || {
                let mut entry = entry;
                persistence.save(&mut entry.session)?;
                entry.dirty = false;
                Ok::<_, io::Error>(())
            })
            .await
            .map_err(io::Error::other)?;
            if let Err(error) = result {
                failure = Some(error);
            }
        }
        failure.map_or(Ok(()), Err)
    }
}
