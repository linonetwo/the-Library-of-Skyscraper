use crate::{PublishedScript, ReplayOperation, ScriptDecision, ScriptMetadata, Session};
use std::collections::BTreeSet;

impl Session {
    pub fn publish_script(&mut self, owner: &str, script: PublishedScript) {
        let hash = self.archive_script(owner, script, self.tick);
        self.rollback_script(owner, &hash).unwrap();
    }

    pub fn disable_script(&mut self, owner: &str) {
        self.scripts.remove(owner);
        self.set_script_metadata(owner, None);
    }

    pub(crate) fn set_script_metadata(&mut self, owner: &str, script: Option<ScriptMetadata>) {
        if self.simulation_version >= 3 && (script.is_some() || self.simulation_version >= 6) {
            let entities: Vec<_> = self
                .world
                .query::<(bevy_ecs::prelude::Entity, &crate::Actor)>()
                .iter(&self.world)
                .filter(|(_, a)| a.owner == owner)
                .map(|(e, _)| e)
                .collect();
            for e in entities {
                let mut actor = self.world.get_mut::<crate::Actor>(e).unwrap();
                if script.is_some() {
                    actor.task = None;
                }
                if self.simulation_version >= 6 {
                    // A controller change keeps the committed route, not its old latch.
                    actor.retreating = false;
                }
            }
        }
        if let Some(tactics) = &mut self.tactics {
            for (id, state) in &mut tactics.actor_states {
                if id.starts_with(&format!("{owner}-")) {
                    state.attack_target_id = None;
                }
            }
        }
        self.players.get_mut(owner).unwrap().script = script.clone();
        if script.is_none() {
            self.apply_preset(owner);
        }
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
        self.advance_scripted_recorded(decisions, true);
    }
    pub(crate) fn advance_scripted_recorded(
        &mut self,
        mut decisions: Vec<ScriptDecision>,
        runtime_validated: bool,
    ) {
        if self.result.is_some() {
            return;
        }
        for decision in &mut decisions {
            if runtime_validated && decision.failure.is_none() {
                match self.prepare_rule_state(decision) {
                    Ok(state) => {
                        self.rule_runtime.insert(decision.player_id.clone(), state);
                    }
                    Err(error) => {
                        decision.failure = Some(error);
                        decision.intents.clear();
                        decision.memory_patch = None;
                        decision.task_patches = None;
                    }
                }
            }
            if decision.failure.is_some() {
                decision.chants = None;
                decision.intents.clear();
                decision.memory_patch = None;
                decision.task_patches = None;
            }
            if let Some(message) = &decision.failure {
                self.event("script-error", message.clone(), Some(&decision.player_id));
                continue;
            }
            let mut intents: Vec<_> = decision.intents.iter().cloned().enumerate().collect();
            intents.sort_by(|(_, a), (_, b)| {
                b.priority
                    .total_cmp(&a.priority)
                    .then_with(|| a.actor_id.cmp(&b.actor_id))
            });
            let mut selected = BTreeSet::new();
            for (intent_index, intent) in intents {
                if !selected.insert(intent.actor_id.clone())
                    || self.manual_actions.get(&intent.actor_id) == Some(&self.tick)
                {
                    continue;
                }
                let result = if let crate::ScriptAction::Build { room_id, kind } = &intent.action {
                    if self.simulation_version >= 3 {
                        self.build_with_actor(&decision.player_id, &intent.actor_id, room_id, kind)
                    } else {
                        self.actor(&decision.player_id, &intent.actor_id)
                            .and_then(|(_, actor)| {
                                if actor.room_id != *room_id {
                                    return Err("builder must be in the target room".into());
                                }
                                self.apply_command(&decision.player_id, intent.command())
                            })
                    }
                } else {
                    let chant = decision
                        .chants
                        .as_ref()
                        .and_then(|records| {
                            records.iter().find(|c| c.intent_index() == intent_index)
                        })
                        .map(|c| (c, intent_index));
                    self.apply_command_with_chant(&decision.player_id, intent.command(), chant)
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
        self.record_operation(ReplayOperation::ScriptAdvance {
            decisions,
            runtime_validated,
        });
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
