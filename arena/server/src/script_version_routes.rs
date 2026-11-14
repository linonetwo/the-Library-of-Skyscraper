use crate::store::{Error, Store, error};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use serde::Deserialize;
use serde_json::{Value, json};
use skyscraper_arena_server::{ScriptVersionList, Snapshot};

pub async fn versions(
    State(store): State<Store>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<ScriptVersionList>, Error> {
    store
        .with_player(&id, &headers, |session, owner| {
            Ok(Json(session.script_versions(owner)))
        })
        .await
}

pub async fn version(
    State(store): State<Store>,
    Path((id, hash)): Path<(String, String)>,
    headers: HeaderMap,
) -> Result<Json<Value>, Error> {
    store
        .with_player(&id, &headers, |session, owner| {
            let version = session
                .script_version(owner, &hash)
                .ok_or_else(|| error(StatusCode::NOT_FOUND, "script version not found"))?;
            Ok(Json(
                json!({ "version": version.metadata, "project": version.script.project }),
            ))
        })
        .await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rollback {
    pub source_hash: String,
}

pub async fn rollback(
    State(store): State<Store>,
    Path(id): Path<String>,
    headers: HeaderMap,
    Json(input): Json<Rollback>,
) -> Result<Json<Snapshot>, Error> {
    store
        .edit_player(&id, &headers, |session, owner| {
            if session.result.is_some() {
                return Err(error(
                    StatusCode::CONFLICT,
                    "reset training or create a new session before switching rules",
                ));
            }
            session
                .rollback_script(owner, &input.source_hash)
                .map_err(|message| error(StatusCode::NOT_FOUND, &message))?;
            Ok(Json(session.snapshot()))
        })
        .await
}

#[cfg(test)]
mod tests;
