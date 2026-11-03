use crate::{Actor, Session};
use bevy_ecs::prelude::Entity;

impl Session {
    pub(crate) fn gather(&mut self, entity: Entity, mut actor: Actor) -> Result<(), String> {
        let idx = self.room_index(&actor.room_id)?;
        let amount = self.rooms[idx]
            .resources
            .min(actor.cargo_capacity - actor.cargo)
            .min(if actor.role == "gatherer" { 8 } else { 3 });
        if amount == 0 {
            return Err("gather requires resources and cargo space".into());
        }
        self.rooms[idx].resources -= amount;
        actor.cargo += amount;
        actor.state = "gathering".into();
        self.event(
            "gather",
            format!(
                "{} 装入 {amount} 建材（{}/{}）",
                actor.id, actor.cargo, actor.cargo_capacity
            ),
            Some(&actor.owner),
        );
        self.world.entity_mut(entity).insert(actor);
        Ok(())
    }

    pub(crate) fn deliver(&mut self, entity: Entity, mut actor: Actor) -> Result<(), String> {
        if actor.room_id != "room-0" || actor.cargo == 0 {
            return Err("deliver requires cargo at base".into());
        }
        self.players.get_mut(&actor.owner).unwrap().materials += actor.cargo;
        self.event(
            "deliver",
            format!("{} 将 {} 建材送入中庭仓库", actor.id, actor.cargo),
            Some(&actor.owner),
        );
        actor.cargo = 0;
        actor.state = "delivering".into();
        self.world.entity_mut(entity).insert(actor);
        Ok(())
    }

    pub(crate) fn transport(&mut self, entity: Entity, mut actor: Actor, current: usize) -> bool {
        if actor.cargo == 0 {
            return false;
        }
        let depleted = self.rooms[current].kind == "resource" && self.rooms[current].resources == 0;
        if actor.cargo == actor.cargo_capacity || depleted {
            actor.room_id = "room-0".into();
            actor.state = "transporting".into();
            self.event(
                "transport",
                format!("{} 携 {} 建材返回中庭", actor.id, actor.cargo),
                Some(&actor.owner),
            );
            self.world.entity_mut(entity).insert(actor);
            return true;
        }
        false
    }

    pub(crate) fn resource_destination(&self, preferred: usize) -> usize {
        if self.rooms[preferred].resources > 0 {
            preferred
        } else {
            self.rooms.iter().position(|r| r.resources > 0).unwrap_or(0)
        }
    }
}
