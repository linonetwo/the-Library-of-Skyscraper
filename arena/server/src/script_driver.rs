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
    let mut official_sources = Vec::new();
    for (owner, script) in &session.scripts {
        let request =
            json!({ "bundle": script.bundle, "context": rule_context(snapshot.clone(), owner) });
        let mut request = request;
        let state = session.rule_state(owner, script.bundle["sourceHash"].as_str());
        request["context"]["memory"] = state["memory"].clone();
        request["context"]["tasks"] = state["tasks"].clone();
        let outcome = workers.execute(&request).await;
        let mut decision = ScriptDecision {
            chants: None,
            source_hash: None,
            memory_patch: None,
            task_patches: None,
            player_id: owner.clone(),
            intents: vec![],
            failure: None,
        };
        let outcome_copy = outcome.clone();
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
        decision.source_hash = script.bundle["sourceHash"].as_str().map(str::to_owned);
        if let Ok(response) = &outcome_copy {
            if let Some(chants) = response.get("chants") {
                match serde_json::from_value::<Vec<skyscraper_arena_server::ChantRecord>>(
                    chants.clone(),
                ) {
                    Ok(chants) => {
                        decision.chants = Some(
                            chants
                                .into_iter()
                                .map(skyscraper_arena_server::RecordedChant::Worker)
                                .collect(),
                        )
                    }
                    Err(error) => decision.failure = Some(format!("worker chants: {error}")),
                }
            }
            decision.memory_patch = response["decision"].get("memoryPatch").cloned();
            if let Some(patches) = response["decision"].get("taskPatches") {
                match serde_json::from_value(patches.clone()) {
                    Ok(value) => decision.task_patches = Some(value),
                    Err(error) => decision.failure = Some(format!("script output: {error}")),
                }
            }
        }
        if let Some(chants) = &decision.chants {
            for chant in chants {
                if let skyscraper_arena_server::RecordedChant::Worker(record) = chant
                    && Some(record.skill_source_hash.as_str())
                        != script.bundle["sourceHash"].as_str()
                {
                    official_sources.push((owner.clone(), record.skill_source_hash.clone()));
                }
            }
        }
        decisions.push(decision);
    }
    for (owner, hash) in official_sources {
        session.archive_official_chant(&owner, &hash, crate::manual_cast::OFFICIAL_SOURCE);
    }
    session.advance_scripted(decisions);
}
