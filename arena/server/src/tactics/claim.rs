use super::{
    command::unavailable,
    point_presence::{point, presence},
};
use crate::{
    Actor, ActorTask, Session, TacticalAction, TacticalEvent, TacticalPhase, TacticalValues,
};

impl Session {
    pub(crate) fn claim_point(
        &mut self,
        owner: &str,
        actor_id: &str,
        room: &str,
    ) -> Result<(), String> {
        let (entity, mut actor) = self.owned_actor(owner, actor_id)?;
        let reason = unavailable(self, &actor).or_else(|| {
            if !self
                .tactics
                .as_ref()
                .unwrap()
                .control_points
                .contains_key(room)
            {
                Some("not-control-point")
            } else if actor.room_id != room {
                Some("point-outside-room")
            } else {
                None
            }
        });
        if let Some(reason) = reason {
            self.tactical_reject(
                &actor,
                room,
                TacticalAction::Claim,
                reason,
                Default::default(),
            );
            return Ok(());
        }
        self.tactics
            .as_mut()
            .unwrap()
            .actor_states
            .get_mut(actor_id)
            .unwrap()
            .attack_target_id = None;
        crate::action_runtime::assign_task(
            &mut actor.task,
            ActorTask {
                kind: "claim".into(),
                target: room.into(),
                stage: "claiming".into(),
                stage_started_tick: self.tick,
                blocked_reason: None,
                building_kind: None,
            },
            self.tick,
            self.simulation_version,
        );
        actor.state = "claiming".into();
        self.tactical_result(
            &actor,
            room,
            TacticalAction::Claim,
            TacticalPhase::Started,
            None,
            Default::default(),
        );
        self.world.entity_mut(entity).insert(actor);
        Ok(())
    }
    pub(crate) fn control_points_tick(&mut self) {
        let actors: Vec<_> = self
            .world
            .query::<&Actor>()
            .iter(&self.world)
            .cloned()
            .collect();
        let rooms: Vec<_> = self
            .tactics
            .as_ref()
            .unwrap()
            .control_points
            .keys()
            .cloned()
            .collect();
        for room in rooms {
            let present = presence(self, &room, &actors);
            let room_index = self.room_index(&room).unwrap();
            let old = self.tactics.as_ref().unwrap().control_points[&room].clone();
            if let Some(reason) = present.blocked {
                let state = self
                    .tactics
                    .as_mut()
                    .unwrap()
                    .control_points
                    .get_mut(&room)
                    .unwrap();
                state.challenger_id = None;
                state.progress_ticks = 0;
                if old.progress_ticks > 0 {
                    self.tactical_event(
                        TacticalEvent {
                            action: TacticalAction::Claim,
                            actor_id: old.last_actor_id.unwrap(),
                            target_id: room.clone(),
                            phase: if present.contested {
                                TacticalPhase::Contested
                            } else {
                                TacticalPhase::Reset
                            },
                            reason_code: Some(reason.into()),
                            values: TacticalValues {
                                progress_ticks: Some(0),
                                owner_id: self.rooms[room_index].owner.clone(),
                                ..Default::default()
                            },
                        },
                        None,
                    );
                }
                continue;
            }
            let (owner, ids) = present.claimants.iter().next().unwrap();
            let actor_id = ids.iter().min().unwrap().clone();
            let mut phase = TacticalPhase::Progress;
            let previous_owner = self.rooms[room_index].owner.clone();
            if previous_owner.as_deref() != Some(owner) {
                let state = self
                    .tactics
                    .as_mut()
                    .unwrap()
                    .control_points
                    .get_mut(&room)
                    .unwrap();
                state.progress_ticks = if state.challenger_id.as_ref() == Some(owner) {
                    state.progress_ticks + 1
                } else {
                    1
                };
                state.challenger_id = Some(owner.clone());
                state.last_actor_id = Some(actor_id.clone());
                if state.progress_ticks
                    >= point(&room).unwrap()["requiredTicks"].as_u64().unwrap() as u32
                {
                    self.rooms[room_index].owner = Some(owner.clone());
                    state.progress_ticks = 0;
                    state.challenger_id = None;
                    phase = TacticalPhase::Captured;
                }
                self.tactical_event(
                    TacticalEvent {
                        action: TacticalAction::Claim,
                        actor_id,
                        target_id: room.clone(),
                        phase,
                        reason_code: None,
                        values: TacticalValues {
                            progress_ticks: Some(if phase == TacticalPhase::Captured {
                                point(&room).unwrap()["requiredTicks"].as_u64().unwrap() as u32
                            } else {
                                self.tactics.as_ref().unwrap().control_points[&room].progress_ticks
                            }),
                            previous_owner_id: previous_owner,
                            owner_id: self.rooms[room_index].owner.clone(),
                            ..Default::default()
                        },
                    },
                    Some(owner),
                );
            }
            // One score per owner/point/tick, not one per claimant; capture tick is first owned tick.
            if self.rooms[room_index].owner.as_deref() == Some(owner) {
                let state = self
                    .tactics
                    .as_mut()
                    .unwrap()
                    .control_points
                    .get_mut(&room)
                    .unwrap();
                state.challenger_id = None;
                state.progress_ticks = 0;
                self.players.get_mut(owner).unwrap().score += 1;
            }
        }
    }
}
