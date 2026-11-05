use crate::persistence::Persistence;
use axum::{
    Json,
    http::{HeaderMap, StatusCode},
};
use skyscraper_arena_server::Session;
use std::{
    collections::{BTreeMap, BTreeSet},
    io,
    path::PathBuf,
    sync::Arc,
};
use tokio::sync::{Mutex, watch};

pub type Error = (StatusCode, Json<serde_json::Value>);

pub fn error(status: StatusCode, message: &str) -> Error {
    (status, Json(serde_json::json!({"error": message})))
}

struct Sessions {
    entries: BTreeMap<String, Session>,
    dirty: BTreeSet<String>,
}

#[derive(Clone)]
pub struct Store {
    sessions: Arc<Mutex<Sessions>>,
    persistence: Arc<Persistence>,
    pub shutdown: watch::Sender<bool>,
}

impl Store {
    pub fn open(directory: PathBuf) -> io::Result<Self> {
        let persistence = Persistence::open(directory)?;
        let entries = persistence.restore()?;
        println!("Restored {} arena sessions", entries.len());
        Ok(Self {
            sessions: Arc::new(Mutex::new(Sessions {
                entries,
                dirty: BTreeSet::new(),
            })),
            persistence: Arc::new(persistence),
            shutdown: watch::channel(false).0,
        })
    }

    pub async fn insert(&self, session: Session) {
        let mut sessions = self.sessions.lock().await;
        sessions.dirty.insert(session.id.clone());
        sessions.entries.insert(session.id.clone(), session);
    }

    async fn access<T>(
        &self,
        id: &str,
        edit: bool,
        action: impl FnOnce(&mut Session) -> Result<T, Error>,
    ) -> Result<T, Error> {
        let mut sessions = self.sessions.lock().await;
        let session = sessions
            .entries
            .get_mut(id)
            .ok_or_else(|| error(StatusCode::NOT_FOUND, "session not found"))?;
        let result = action(session)?;
        if edit {
            sessions.dirty.insert(id.into());
        }
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
        self.token_access(id, token, false, action).await
    }

    async fn token_access<T>(
        &self,
        id: &str,
        token: &str,
        edit: bool,
        action: impl FnOnce(&mut Session, &str) -> Result<T, Error>,
    ) -> Result<T, Error> {
        self.access(id, edit, |session| {
            let owner = session.tokens.get(token).cloned().ok_or_else(|| {
                error(
                    StatusCode::UNAUTHORIZED,
                    "valid session bearer token required",
                )
            })?;
            action(session, &owner)
        })
        .await
    }

    pub async fn with_player<T>(
        &self,
        id: &str,
        headers: &HeaderMap,
        action: impl FnOnce(&mut Session, &str) -> Result<T, Error>,
    ) -> Result<T, Error> {
        self.player_access(id, headers, false, action).await
    }

    pub async fn edit_player<T>(
        &self,
        id: &str,
        headers: &HeaderMap,
        action: impl FnOnce(&mut Session, &str) -> Result<T, Error>,
    ) -> Result<T, Error> {
        self.player_access(id, headers, true, action).await
    }

    async fn player_access<T>(
        &self,
        id: &str,
        headers: &HeaderMap,
        edit: bool,
        action: impl FnOnce(&mut Session, &str) -> Result<T, Error>,
    ) -> Result<T, Error> {
        let token = headers
            .get("authorization")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.strip_prefix("Bearer "))
            .unwrap_or("");
        self.token_access(id, token, edit, action).await
    }

    pub async fn advance(&self) {
        let mut sessions = self.sessions.lock().await;
        let Sessions { entries, dirty } = &mut *sessions;
        for session in entries.values_mut() {
            if !session.paused {
                let tick = session.tick;
                session.advance();
                if tick != session.tick {
                    dirty.insert(session.id.clone());
                }
            }
        }
    }

    pub async fn checkpoint(&self) -> io::Result<()> {
        let sessions = self.sessions.clone().lock_owned().await;
        let persistence = self.persistence.clone();
        tokio::task::spawn_blocking(move || {
            let mut sessions = sessions;
            let ids: Vec<_> = sessions.dirty.iter().cloned().collect();
            let mut failure = None;
            for id in ids {
                match persistence.save(sessions.entries.get_mut(&id).unwrap()) {
                    Ok(()) => {
                        sessions.dirty.remove(&id);
                    }
                    Err(error) => {
                        failure = Some(io::Error::other(format!("session {id}: {error}")));
                    }
                }
            }
            failure.map_or(Ok(()), Err)
        })
        .await
        .map_err(io::Error::other)?
    }
}
