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
    Json(request): Json<PreviewRequest>,
) -> Result<Json<Value>, Error> {
    let project = match request {
        PreviewRequest::Compare(request) => {
            return compare::preview_compare(&store, &id, &headers, request)
                .await
                .map(Json);
        }
        PreviewRequest::Live(project) => project,
    };
    store.with_player(&id, &headers, |_, _| Ok(())).await?;
    let compilation = compile_project(&project).await?;
    let hash = compilation["bundle"]["sourceHash"].as_str();
    let context = store
        .with_player(&id, &headers, |session, owner| {
            let state = session.rule_state(owner, hash);
            let mut context = rule_context(session.snapshot(), owner);
            context["memory"] = state["memory"].clone();
            context["tasks"] = state["tasks"].clone();
            Ok(context)
        })
        .await?;
    let mut response =
        json!({ "tick": context["tick"], "sourceHash": hash, "compilation": compilation });
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
    let mut context = json!({
       "tick": snapshot.tick,
       "player": player,
       "squad": { "actors": actors },
       "world": {
           "rooms": snapshot.rooms,
           "actors": snapshot.actors,
           "buildings": snapshot.buildings,
           "enemies": snapshot.enemies,
           "worldMap": snapshot.world_map,
           "scenario": snapshot.scenario,
           "scenarioConfig": snapshot.scenario_config,
       },
       "tasks": { "items": [] },
       "memory": {},
       "limits": {
           "maxIntents": actors.len() * 2,
           "maxTaskPatches": skyscraper_arena_server::script_state::MAX_TASK_PATCHES,
           "maxLogEntries": 32,
           "maxMemoryBytes": skyscraper_arena_server::script_state::MAX_MEMORY_BYTES,
           "remainingBudgetTokens": 10000,
       },
    });
    if let Some(scenario) = snapshot.scenario_id {
        context["world"]["scenarioId"] = json!(scenario);
    }
    if let Some(tactics) = snapshot.tactics {
        context["world"]["tactics"] = json!(tactics);
    }
    context
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
mod history_tests;
#[cfg(test)]
mod publish_tests;
#[cfg(test)]
mod tests;

pub async fn state(
    State(store): State<Store>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Value>, Error> {
    store
        .with_player(&id, &headers, |session, owner| {
            let hash = session
                .players
                .get(owner)
                .and_then(|p| p.script.as_ref())
                .map(|s| s.source_hash.as_str());
            let mut state = session.rule_state(owner, hash);
            state["operationIndex"] = json!(session.recorded_operation_index());
            Ok(Json(state))
        })
        .await
}

mod compare;
pub use compare::PreviewRequest;
#[cfg(test)]
mod compare_tests;
