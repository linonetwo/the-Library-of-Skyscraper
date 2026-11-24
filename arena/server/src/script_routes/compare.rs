use super::*;
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(untagged)]
pub enum PreviewRequest {
    Compare(CompareRequest),
    Live(SourceProject),
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CompareRequest {
    pub operation_index: usize,
    pub a: SourceProject,
    pub b: SourceProject,
    pub initial_state: InitialState,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum InitialState {
    Empty,
}

pub(super) async fn preview_compare(
    store: &Store,
    id: &str,
    headers: &HeaderMap,
    request: CompareRequest,
) -> Result<Value, Error> {
    // Capture one authorized immutable recording before invoking either compiler.
    let (recording, owner) = store
        .with_player(id, headers, |session, owner| {
            session
                .export_replay_for(Some(owner))
                .map(|recording| (recording, owner.to_owned()))
                .map_err(|message| error(StatusCode::CONFLICT, &message))
        })
        .await?;
    let mut restored = recording
        .session_after_operation(request.operation_index)
        .map_err(|message| error(StatusCode::CONFLICT, &message))?;
    if !restored.players.contains_key(&owner) {
        return Err(error(
            StatusCode::CONFLICT,
            "owner has not joined at this operationIndex",
        ));
    }
    // Both source versions receive the identical authoritative world and owner
    // task queue, and both begin with empty private memory. Never select memory
    // by either candidate's hash or by the live session's current publication.
    let state = restored.rule_state(&owner, None);
    let mut context = rule_context(restored.snapshot(), &owner);
    context["tasks"] = state["tasks"].clone();
    match request.initial_state {
        InitialState::Empty => context["memory"] = json!({}),
    }
    let a = run_candidate(store, &request.a, &context).await;
    let b = run_candidate(store, &request.b, &context).await;
    Ok(json!({
        "kind": "comparison", "sessionId": id, "ownerId": owner,
        "operationIndex": request.operation_index, "tick": context["tick"],
        "initialState": {"mode":"empty", "memory":{}, "tasks":"recorded"},
        "context":context, "a": a, "b": b,
    }))
}

async fn run_candidate(store: &Store, project: &SourceProject, context: &Value) -> Value {
    let compilation = match compile_project(project).await {
        Ok(result) => result,
        Err((_, Json(error))) => return json!({"error":error["error"]}),
    };
    let mut result =
        json!({"sourceHash":compilation["bundle"]["sourceHash"], "compilation":compilation});
    if let Some(bundle) = result["compilation"].get("bundle") {
        match store
            .workers
            .execute(&json!({"bundle":bundle,"context":context}))
            .await
        {
            Ok(execution) => result["execution"] = execution,
            Err(message) => result["error"] = json!(message),
        }
    }
    result
}
