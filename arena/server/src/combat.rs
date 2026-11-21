use crate::{Actor, Session};
use bevy_ecs::prelude::Entity;
impl Session {
    pub(crate) fn actor_attack(&mut self, a: &mut Actor) -> Result<(), String> {
        if a.hp == 0 || a.travel.is_some() || a.retreating {
            return Err("attack requires alive stationary actor".into());
        }
        if self.tick < a.action_tick + crate::scenario::number("combatIntervalTicks") {
            return Err("attack cooldown".into());
        }
        let range = crate::scenario::number("attackRange") * 1000;
        let target = self
            .enemies
            .iter()
            .position(|e| {
                e.hp > 0 && crate::travel::distance(a.world_position, e.world_position) <= range
            })
            .ok_or("no visible hostile in world attack range")?;
        let dmg = crate::scenario::number(if a.role == "guard" {
            "guardDamage"
        } else {
            "actorDamage"
        }) as u32;
        let e = &mut self.enemies[target];
        e.hp = e.hp.saturating_sub(dmg);
        e.state = if e.hp == 0 { "downed" } else { "fighting" }.into();
        let id = e.id.clone();
        a.action_tick = self.tick;
        a.state = "fighting".into();
        self.event(
            "combat",
            format!("{} → {id}: {dmg}伤害", a.id),
            Some(&a.owner),
        );
        Ok(())
    }
    pub(crate) fn combat_tick(&mut self) {
        let mut actors: Vec<_> = self
            .world
            .query::<(Entity, &Actor)>()
            .iter(&self.world)
            .map(|(e, a)| (e, a.clone()))
            .collect();
        actors.sort_by(|a, b| a.1.id.cmp(&b.1.id));
        for (e, mut a) in actors {
            if a.hp == 0 || a.travel.is_some() || a.retreating {
                continue;
            }
            if a.task.as_ref().is_some_and(|t| t.kind == "guard")
                && let Some(enemy) = self
                    .enemies
                    .iter()
                    .find(|enemy| enemy.hp > 0 && enemy.room_id == a.room_id)
            {
                crate::travel::approach(&mut a.world_position, enemy.world_position, 1800);
            }
            if self.players[&a.owner].script.is_none() {
                let _ = self.actor_attack(&mut a);
            }
            self.world.entity_mut(e).insert(a);
        }
        for i in 0..self.enemies.len() {
            if self.enemies[i].hp == 0 || self.enemies[i].travel.is_some() {
                continue;
            }
            let pos = self.enemies[i].world_position;
            // Pursuit is confined to the guardian's room, but damage always uses world distance.
            let mut targets: Vec<_> = self
                .world
                .query::<(Entity, &Actor)>()
                .iter(&self.world)
                .filter(|(_, a)| {
                    a.hp > 0
                        && ((a.room_id == self.enemies[i].room_id
                            && crate::travel::distance(
                                a.world_position,
                                crate::travel::center(&self.enemies[i].room_id),
                            ) <= 4000)
                            || crate::travel::distance(a.world_position, pos) <= 2000)
                })
                .map(|(e, a)| (e, a.clone()))
                .collect();
            targets.sort_by(|a, b| {
                (a.1.role != "guard")
                    .cmp(&(b.1.role != "guard"))
                    .then_with(|| a.1.id.cmp(&b.1.id))
            });
            if let Some((entity, mut a)) = targets.into_iter().next() {
                if crate::travel::distance(
                    a.world_position,
                    crate::travel::center(&self.enemies[i].room_id),
                ) <= 4000
                {
                    crate::travel::approach(
                        &mut self.enemies[i].world_position,
                        a.world_position,
                        1800,
                    );
                }
                if crate::travel::distance(a.world_position, self.enemies[i].world_position)
                    <= crate::scenario::number("attackRange") * 1000
                    && self.tick
                        >= self.enemies[i].action_tick
                            + crate::scenario::number("combatIntervalTicks")
                {
                    self.enemies[i].action_tick = self.tick;
                    let dmg = crate::scenario::number("enemyDamage") as u32;
                    a.hp = a.hp.saturating_sub(dmg);
                    self.event(
                        "damage",
                        format!(
                            "{} 对 {} 造成{dmg}伤害，HP {}",
                            self.enemies[i].id, a.id, a.hp
                        ),
                        Some(&a.owner),
                    );
                    if a.hp == 0 {
                        a.travel = None;
                        a.state = "downed".into();
                        self.scenario.report.downed += 1;
                        self.scenario.report.cargo_lost += a.cargo;
                        a.cargo = 0;
                        self.event(
                            "downed",
                            format!("{} 倒地，本局无法复活", a.id),
                            Some(&a.owner),
                        );
                    }
                    self.world.entity_mut(entity).insert(a);
                }
            } else {
                let mut bs: Vec<_> = self
                    .buildings
                    .iter()
                    .enumerate()
                    .filter(|(_, b)| b.hp > 0 && b.room_id == self.enemies[i].room_id)
                    .map(|(j, b)| (j, b.kind != "tower", b.id.clone()))
                    .collect();
                bs.sort_by(|a, b| a.1.cmp(&b.1).then_with(|| a.2.cmp(&b.2)));
                if let Some((j, _, _)) = bs.first() {
                    let p = crate::travel::center(&self.buildings[*j].room_id);
                    crate::travel::approach(&mut self.enemies[i].world_position, p, 1800);
                    if self.tick
                        >= self.enemies[i].action_tick
                            + crate::scenario::number("combatIntervalTicks")
                        && crate::travel::distance(self.enemies[i].world_position, p) <= 2000
                    {
                        self.enemies[i].action_tick = self.tick;
                        self.buildings[*j].hp = self.buildings[*j]
                            .hp
                            .saturating_sub(crate::scenario::number("enemyDamage") as u32);
                        self.event(
                            "building-damage",
                            format!(
                                "{} 攻击建筑 {}，剩余HP {}",
                                self.enemies[i].id, self.buildings[*j].id, self.buildings[*j].hp
                            ),
                            None,
                        );
                    }
                }
            }
        }
        if self
            .tick
            .is_multiple_of(crate::scenario::number("combatIntervalTicks"))
        {
            let towers: Vec<_> = self
                .buildings
                .iter()
                .filter(|b| {
                    b.kind == "tower" && b.hp > 0 && b.construction_ticks >= b.required_ticks
                })
                .cloned()
                .collect();
            for b in towers {
                if let Some(e) = self.enemies.iter_mut().find(|e| {
                    e.hp > 0
                        && crate::travel::distance(
                            e.world_position,
                            crate::travel::center(&b.room_id),
                        ) <= crate::scenario::number("towerRange") * 1000
                }) {
                    let dmg = crate::scenario::number("towerDamage") as u32;
                    e.hp = e.hp.saturating_sub(dmg);
                    self.event(
                        "tower-attack",
                        format!("{} 防御射击 {dmg}伤害", b.id),
                        Some(&b.owner),
                    );
                }
            }
        }
        for room in &mut self.rooms {
            room.enemy_hp = self
                .enemies
                .iter()
                .filter(|e| e.room_id == room.id)
                .map(|e| e.hp)
                .sum();
        }
    }
}
