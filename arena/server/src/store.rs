use axum::{
    Json,
    http::{HeaderMap, StatusCode},
};
use skyscraper_arena_server::Session;
use std::{collections::BTreeMap, sync::Arc};
use tokio::sync::Mutex;

pub type Error = (StatusCode, Json<serde_json::Value>);

pub fn error(status: StatusCode, message: &str) -> Error {
    (status, Json(serde_json::json!({"error": message})))
}

#[derive(Clone, Default)]
pub struct Store(Arc<Mutex<BTreeMap<String, Session>>>);

impl Store {
    pub async fn insert(&self, session: Session) {
        self.0.lock().await.insert(session.id.clone(), session);
    }

    pub async fn with_session<T>(
        &self,
        id: &str,
        action: impl FnOnce(&mut Session) -> Result<T, Error>,
    ) -> Result<T, Error> {
        let mut sessions = self.0.lock().await;
        let session = sessions
            .get_mut(id)
            .ok_or_else(|| error(StatusCode::NOT_FOUND, "session not found"))?;
        action(session)
    }

    pub async fn with_token<T>(
        &self,
        id: &str,
        token: &str,
        action: impl FnOnce(&mut Session, &str) -> Result<T, Error>,
    ) -> Result<T, Error> {
        self.with_session(id, |session| {
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
        let token = headers
            .get("authorization")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.strip_prefix("Bearer "))
            .unwrap_or("");
        self.with_token(id, token, action).await
    }

    pub async fn advance(&self) {
        for session in self.0.lock().await.values_mut() {
            if !session.paused {
                session.advance();
            }
        }
    }
}
