use crate::{Actor, ReplayOperation, ResultSummary, Session};
use bevy_ecs::prelude::Entity;

impl Session {
    pub fn advance(&mut self) {
        if self.result.is_none() {
            self.advance_unrecorded();
            self.record_operation(ReplayOperation::Advance {});
        }
    }
    pub(crate) fn advance_unrecorded(&mut self) {
        if self.result.is_some() {
            return;
        }
        self.tick += 1;
        let mut actors: Vec<_> = self
            .world
            .query::<(Entity, &Actor)>()
            .iter(&self.world)
            .map(|(e, a)| (e, a.clone()))
            .collect();
        actors.sort_by(|a, b| a.1.id.cmp(&b.1.id));
        for (entity, mut a) in actors {
            // A manual action replaces, rather than supplements, this actor's next
            // autonomous turn. Commands are immediate for responsive local controls.
            if self.manual_actions.get(&a.id) == Some(&(self.tick - 1)) {
                continue;
            }
            let rule = self.players[&a.owner].rule.clone();
            if a.hp <= rule.retreat_hp {
                a.room_id = "room-0".into();
                a.hp = (a.hp + 10).min(100);
                a.state = "retreating".into();
                self.world.entity_mut(entity).insert(a);
                continue;
            }
            let current = self.room_index(&a.room_id).unwrap();
            if self
                .buildings
                .iter()
                .any(|b| b.owner == a.owner && b.room_id == a.room_id && b.kind == "tower")
            {
                a.hp = (a.hp + 3).min(a.max_hp);
                self.world.entity_mut(entity).insert(a.clone());
            }
            if self.rooms[current].enemy_hp > 0 {
                let _ = self.attack(entity, a);
                continue;
            }
            if self.rooms[current].resources > 0
                && (a.role == "gatherer" || rule.preset == "gather")
            {
                let _ = self.gather(entity, a);
                continue;
            }
            if ["catalog", "ruins"].contains(&self.rooms[current].kind.as_str())
                && self.rooms[current].owner.as_deref() != Some(&a.owner)
            {
                let _ = self.capture(&a);
            }
            let desired = match rule.preset.as_str() {
                "defend" => 0,
                "gather" => {
                    if a.role == "gatherer" {
                        1
                    } else if a.role == "scout" {
                        2
                    } else {
                        3
                    }
                }
                _ => match a.role.as_str() {
                    "scout" => 5,
                    "guard" => 6,
                    _ => 4,
                },
            };
            if current != desired {
                // All destinations connect through the central hex; one edge per tick.
                a.room_id = format!("room-{}", if current == 0 { desired } else { 0 });
                a.state = "moving".into();
            } else {
                a.state = if rule.preset == "defend" {
                    "guarding"
                } else {
                    "idle"
                }
                .into();
            }
            self.world.entity_mut(entity).insert(a);
        }
        if self.tick.is_multiple_of(5) {
            let occupants: Vec<Actor> = self
                .world
                .query::<&Actor>()
                .iter(&self.world)
                .cloned()
                .collect();
            for room in &self.rooms {
                if let Some(owner) = &room.owner
                    && !occupants
                        .iter()
                        .any(|a| a.room_id == room.id && a.hp > 0 && &a.owner != owner)
                {
                    self.players.get_mut(owner).unwrap().score += 2;
                }
            }
            for building in &self.buildings {
                if building.kind == "catalog" {
                    self.players.get_mut(&building.owner).unwrap().score += 1;
                }
            }
        }
        if self.tick >= 120 {
            let winner = self
                .players
                .values()
                .max_by(|a, b| a.score.cmp(&b.score).then_with(|| b.id.cmp(&a.id)))
                .map(|p| p.id.clone())
                .unwrap_or_default();
            self.result = Some(ResultSummary {
                winner,
                reason: "120 tick 训练/短赛局完成，按编目分结算".into(),
            });
            self.event("settlement", "赛局结算：编目分已锁定".into(), None);
        }
    }
}
