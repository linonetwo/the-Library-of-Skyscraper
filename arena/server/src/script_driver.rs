use crate::{script_routes::rule_context, script_worker::ScriptWorkers};
use serde_json::json;
use skyscraper_arena_server::{ScriptDecision, Session};

pub async fn advance(session: &mut Session, workers: &ScriptWorkers) {
    if session.result.is_some() {
        return;
    }
    if session.scripts.is_empty() {
        session.advance();
        return;
    }
    let snapshot = session.snapshot();
    let mut decisions = Vec::new();
    for (owner, script) in &session.scripts {
        let request =
            json!({ "bundle": script.bundle, "context": rule_context(snapshot.clone(), owner) });
        let outcome = workers.execute(&request).await;
        let mut decision = ScriptDecision {
            player_id: owner.clone(),
            intents: vec![],
            failure: None,
        };
        match outcome {
            Ok(response) if response.get("decision").is_some() => {
                match serde_json::from_value(response["decision"]["intents"].clone()) {
                    Ok(intents) => decision.intents = intents,
                    Err(error) => decision.failure = Some(format!("script output: {error}")),
                }
            }
            Ok(response) => {
                decision.failure = Some(
                    response["failure"]["message"]
                        .as_str()
                        .unwrap_or("script execution failed")
                        .into(),
                )
            }
            Err(error) => decision.failure = Some(error),
        }
        decisions.push(decision);
    }
    session.advance_scripted(decisions);
}
