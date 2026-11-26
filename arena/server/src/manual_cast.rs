//! Manual casting enters the same compiler/worker recipe path as authored rules.
use crate::{
    script_routes::rule_context,
    script_toolchain::{compile_project, service_error},
    script_worker::ScriptWorkers,
    store::{Error, error},
};
use axum::http::StatusCode;
use serde_json::{Value, json};
use skyscraper_arena_server::{ChantRecord, Command, RecordedChant, Session, SourceProject};
use std::collections::BTreeMap;
use tokio::sync::OnceCell;

pub(crate) const OFFICIAL_SOURCE: &str = include_str!("../../script-sdk/skills/ink-strike.js");

async fn manual_bundle() -> Result<&'static Value, Error> {
    static BUNDLE: OnceCell<Value> = OnceCell::const_new();
    BUNDLE
        .get_or_try_init(|| async {
            let project = SourceProject {
                entry: Some("main.ts".into()),
                files: BTreeMap::from([(
                    "main.ts".into(),
                    "export function decide(ctx:any){return {intents:[ctx.manualCast]};}\n".into(),
                )]),
            };
            let result = compile_project(&project).await?;
            result
                .get("bundle")
                .cloned()
                .ok_or_else(|| service_error("official cast wrapper compilation failed"))
        })
        .await
}

pub async fn execute(
    session: &mut Session,
    owner: &str,
    command: Command,
    workers: &ScriptWorkers,
) -> Result<(), Error> {
    let Command::Cast { actor_id, .. } = &command else {
        unreachable!("manual cast adapter")
    };
    if session.simulation_version < 8 {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "tactics require simulationVersion8",
        ));
    }
    if session.result.is_some() {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "session settled; reset to retry same seed",
        ));
    }
    if session.players[owner].script.is_some() {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "TypeScript驱动小队，请先停用脚本再下达手动任务",
        ));
    }
    let snapshot = session.snapshot();
    if !snapshot
        .actors
        .iter()
        .any(|a| a.id == *actor_id && a.owner == owner)
    {
        return Err(error(StatusCode::BAD_REQUEST, "actor ownership denied"));
    }
    let mut context = rule_context(snapshot, owner);
    context["manualCast"] = serde_json::to_value(&command).unwrap();
    context["manualCast"]["priority"] = json!(100);
    let response = workers
        .execute(&json!({"bundle":manual_bundle().await?,"context":context}))
        .await
        .map_err(service_error)?;
    if response.get("failure").is_some() {
        return Err(service_error("official cast worker failed"));
    }
    let records: Vec<ChantRecord> =
        serde_json::from_value(response["chants"].clone()).map_err(service_error)?;
    let record = records
        .into_iter()
        .find(|c| c.intent_index == 0)
        .ok_or_else(|| service_error("official cast worker returned no chant"))?;
    session.archive_official_chant(owner, &record.skill_source_hash, OFFICIAL_SOURCE);
    session
        .command_with_chant(owner, command, RecordedChant::Worker(record))
        .map_err(|message| error(StatusCode::BAD_REQUEST, &message))
}

#[cfg(test)]
mod tests;
