use crate::store::{Error, Store, error};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use skyscraper_arena_server::Snapshot;
use std::{collections::BTreeMap, path::PathBuf, process::Stdio};
use tokio::{io::AsyncWriteExt, process::Command};

#[derive(Deserialize, Serialize)]
pub struct SourceProject {
    files: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    entry: Option<String>,
}

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
        let runner = std::env::var_os("ARENA_SCRIPT_RUNNER")
            .map(PathBuf::from)
            .map(Ok)
            .unwrap_or_else(|| {
                std::env::current_exe()
                    .map(|path| path.with_file_name("skyscraper-arena-script-runner"))
            })
            .map_err(service_error)?;
        response["execution"] = exchange(
            Command::new(runner),
            &json!({ "bundle": bundle, "context": context }),
        )
        .await?;
    }
    Ok(Json(response))
}

fn rule_context(snapshot: Snapshot, owner: &str) -> Value {
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
            "maxIntents": 32,
            "maxTaskPatches": 0,
            "maxLogEntries": 32,
            "maxMemoryBytes": 65536,
            "remainingBudgetTokens": 10000,
        },
    })
}

async fn compile_project(project: &SourceProject) -> Result<Value, Error> {
    let cli = std::env::var_os("ARENA_SCRIPT_TOOLCHAIN")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../script-toolchain/cli.mjs")
        });
    let mut command = Command::new("node");
    command.arg(cli);
    exchange(command, &serde_json::to_value(project).unwrap()).await
}

async fn exchange(mut command: Command, request: &Value) -> Result<Value, Error> {
    let mut child = command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(service_error)?;
    let mut stdin = child.stdin.take().unwrap();
    let mut bytes = serde_json::to_vec(request).unwrap();
    bytes.push(b'\n');
    stdin.write_all(&bytes).await.map_err(service_error)?;
    drop(stdin);
    let output = child.wait_with_output().await.map_err(service_error)?;
    if !output.status.success() {
        return Err(service_error(String::from_utf8_lossy(&output.stderr)));
    }
    serde_json::from_slice(&output.stdout).map_err(service_error)
}

fn service_error(message: impl std::fmt::Display) -> Error {
    error(
        StatusCode::BAD_GATEWAY,
        &format!("script service: {message}"),
    )
}

#[cfg(test)]
mod tests;
