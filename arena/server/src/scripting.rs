use crate::{PublishedScript, ReplayOperation, ScriptDecision, ScriptMetadata, Session};
use std::collections::BTreeSet;

impl Session {
    pub fn publish_script(&mut self, owner: &str, script: PublishedScript) {
        let metadata = ScriptMetadata {
            source_hash: script.bundle["sourceHash"].as_str().unwrap().into(),
            entry: script.bundle["entry"].as_str().unwrap().into(),
            published_at_tick: self.tick,
        };
        self.scripts.insert(owner.into(), script);
        self.set_script_metadata(owner, Some(metadata));
    }

    pub fn disable_script(&mut self, owner: &str) {
        self.scripts.remove(owner);
        self.set_script_metadata(owner, None);
    }

    pub(crate) fn set_script_metadata(&mut self, owner: &str, script: Option<ScriptMetadata>) {
        self.players.get_mut(owner).unwrap().script = script.clone();
        self.event(
            "script",
            if script.is_some() {
                "TypeScript 行动规则已绑定"
            } else {
                "已恢复预设行动规则"
            }
            .into(),
            Some(owner),
        );
        self.record_operation(ReplayOperation::ScriptPublication {
            player_id: owner.into(),
            script,
        });
    }

    pub fn advance_scripted(&mut self, decisions: Vec<ScriptDecision>) {
        if self.result.is_some() {
            return;
        }
        for decision in &decisions {
            if let Some(message) = &decision.failure {
                self.event("script-error", message.clone(), Some(&decision.player_id));
                continue;
            }
            let mut intents = decision.intents.clone();
            intents.sort_by(|a, b| {
                b.priority
                    .total_cmp(&a.priority)
                    .then_with(|| a.actor_id.cmp(&b.actor_id))
            });
            let mut selected = BTreeSet::new();
            for intent in intents {
                if !selected.insert(intent.actor_id.clone())
                    || self.manual_actions.get(&intent.actor_id) == Some(&self.tick)
                {
                    continue;
                }
                let result = if let crate::ScriptAction::Build { room_id, .. } = &intent.action {
                    self.actor(&decision.player_id, &intent.actor_id)
                        .and_then(|(_, actor)| {
                            if actor.room_id != *room_id {
                                return Err("builder must be in the target room".into());
                            }
                            self.apply_command(&decision.player_id, intent.command())
                        })
                } else {
                    self.apply_command(&decision.player_id, intent.command())
                };
                match result {
                    Ok(()) => {
                        self.manual_actions.insert(intent.actor_id, self.tick);
                    }
                    Err(message) => self.event(
                        "script-rejected",
                        format!("{}: {message}", intent.actor_id),
                        Some(&decision.player_id),
                    ),
                }
            }
        }
        self.advance_unrecorded();
        self.record_operation(ReplayOperation::ScriptAdvance { decisions });
    }

    pub fn validate_step(&self, ticks: u32) -> Result<(), String> {
        if self.mode != crate::Mode::Training {
            return Err("debug commands require training session".into());
        }
        if !(1..=120).contains(&ticks) {
            return Err("ticks must be 1..120".into());
        }
        if !self.paused {
            return Err("pause training before stepping".into());
        }
        if self.result.is_some() {
            return Err("session settled; reset training or create a new session".into());
        }
        Ok(())
    }
}
