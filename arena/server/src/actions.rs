use crate::{Actor, Session};
use bevy_ecs::prelude::Entity;

impl Session {
    pub(crate) fn attack(&mut self, entity: Entity, mut actor: Actor) -> Result<(), String> {
        let idx = self.room_index(&actor.room_id)?;
        if self.rooms[idx].enemy_hp == 0 {
            return Err("no hostile in this room".into());
        }
        let damage = if actor.role == "guard" { 18 } else { 9 };
        self.rooms[idx].enemy_hp = self.rooms[idx].enemy_hp.saturating_sub(damage);
        actor.hp = actor.hp.saturating_sub(7);
        actor.state = "fighting".into();
        self.event(
            "combat",
            format!("{} 对墨影造成 {damage} 伤害", actor.id),
            Some(&actor.owner),
        );
        if self.rooms[idx].enemy_hp == 0 {
            let owners: std::collections::BTreeSet<String> = self
                .world
                .query::<&Actor>()
                .iter(&self.world)
                .filter(|other| other.room_id == actor.room_id && other.hp > 0)
                .map(|other| other.owner.clone())
                .collect();
            let share = 15 / owners.len() as u32;
            for owner in &owners {
                self.players.get_mut(owner).unwrap().score += share;
            }
            self.event(
                "defeat",
                format!("墨影消散，在场小队各获得 {share} 编目分"),
                Some(&actor.owner),
            );
        }
        self.world.entity_mut(entity).insert(actor);
        Ok(())
    }
    pub(crate) fn capture(&mut self, actor: &Actor) -> Result<(), String> {
        let idx = self.room_index(&actor.room_id)?;
        if self.rooms[idx].enemy_hp > 0
            || !["catalog", "ruins"].contains(&self.rooms[idx].kind.as_str())
        {
            return Err("room cannot be catalogued".into());
        }
        if self.rooms[idx].owner.as_deref() == Some(&actor.owner) {
            return Ok(());
        }
        if self.world.query::<&Actor>().iter(&self.world).any(|other| {
            other.room_id == actor.room_id && other.hp > 0 && other.owner != actor.owner
        }) {
            return Err("room contested by another squad".into());
        }
        let first_catalogue = self.rooms[idx].owner.is_none();
        self.rooms[idx].owner = Some(actor.owner.clone());
        if first_catalogue {
            self.players.get_mut(&actor.owner).unwrap().score += 10;
        }
        self.event(
            "capture",
            format!("{} 已编目", self.rooms[idx].name),
            Some(&actor.owner),
        );
        Ok(())
    }
}
