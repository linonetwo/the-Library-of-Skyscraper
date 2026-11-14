use crate::script_toolchain::{compile_project, service_error};
use crate::store::{Error, Store, error};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use serde_json::{Value, json};
use skyscraper_arena_server::{PublishedScript, Snapshot, SourceProject};

pub async fn compile(
    State(store): State<Store>,
    Path(id): Path<String>,
    headers: HeaderMap,
    Json(project): Json<SourceProject>,
) -> Result<Json<Value>, Error> {
    store.with_player(&id, &headers, |_, _| Ok(())).await?;
    compile_project(&project).await.map(Json)
}

pub async fn preview(
    State(store): State<Store>,
    Path(id): Path<String>,
    headers: HeaderMap,
    Json(project): Json<SourceProject>,
) -> Result<Json<Value>, Error> {
    let context = store
        .with_player(&id, &headers, |session, owner| {
            Ok(rule_context(session.snapshot(), owner))
        })
        .await?;
    let compilation = compile_project(&project).await?;
    let mut response = json!({ "tick": context["tick"], "compilation": compilation });
    if let Some(bundle) = response["compilation"].get("bundle") {
        response["execution"] = store
            .workers
            .execute(&json!({ "bundle": bundle, "context": context }))
            .await
            .map_err(service_error)?;
    }
    Ok(Json(response))
}

pub(crate) fn rule_context(snapshot: Snapshot, owner: &str) -> Value {
    let player = snapshot.players.iter().find(|player| player.id == owner);
    let actors: Vec<_> = snapshot
        .actors
        .iter()
        .filter(|actor| actor.owner == owner)
        .collect();
    json!({
        "tick": snapshot.tick,
        "player": player,
        "squad": { "actors": actors },
        "world": {
            "rooms": snapshot.rooms,
            "actors": snapshot.actors,
            "buildings": snapshot.buildings,
        },
        "tasks": { "items": [] },
        "memory": {},
        "limits": {
            "maxIntents": actors.len() * 2,
            "maxTaskPatches": 0,
            "maxLogEntries": 32,
            "maxMemoryBytes": 65536,
            "remainingBudgetTokens": 10000,
        },
    })
}

pub async fn publish(
    State(store): State<Store>,
    Path(id): Path<String>,
    headers: HeaderMap,
    Json(project): Json<SourceProject>,
) -> Result<Json<Value>, Error> {
    store.with_player(&id, &headers, |_, _| Ok(())).await?;
    let compilation = compile_project(&project).await?;
    let mut response = json!({ "compilation": compilation });
    if let Some(bundle) = response["compilation"].get("bundle").cloned() {
        let snapshot = store
            .edit_player(&id, &headers, |session, owner| {
                if session.result.is_some() {
                    return Err(error(
                        StatusCode::CONFLICT,
                        "reset training or create a new session before publishing",
                    ));
                }
                session.publish_script(owner, PublishedScript { project, bundle });
                Ok(session.snapshot())
            })
            .await?;
        response["snapshot"] = serde_json::to_value(snapshot).unwrap();
    }
    Ok(Json(response))
}
pub async fn disable(
    State(store): State<Store>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Snapshot>, Error> {
    store
        .edit_player(&id, &headers, |session, owner| {
            session.disable_script(owner);
            Ok(Json(session.snapshot()))
        })
        .await
}

#[cfg(test)]
mod publish_tests;
#[cfg(test)]
mod tests;
