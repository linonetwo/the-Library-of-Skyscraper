use super::{command::unavailable, scenario::number};
use crate::{Session, TacticalAction, TacticalPhase, TacticalValues};

impl Session {
    pub(crate) fn repair_building(
        &mut self,
        owner: &str,
        actor_id: &str,
        building_id: &str,
    ) -> Result<(), String> {
        let (entity, mut actor) = self.owned_actor(owner, actor_id)?;
        let index = self.buildings.iter().position(|b| b.id == building_id);
        let reason = unavailable(self, &actor).or_else(|| match index {
            None => Some("building-gone"),
            Some(i) if self.buildings[i].owner != owner => Some("building-not-owned"),
            Some(i) if self.buildings[i].hp == 0 => Some("building-destroyed"),
            Some(i) if self.buildings[i].construction_ticks < self.buildings[i].required_ticks => {
                Some("building-incomplete")
            }
            Some(i) if self.buildings[i].hp >= self.buildings[i].max_hp => Some("building-full"),
            Some(i) if self.buildings[i].room_id != actor.room_id => Some("building-outside-room"),
            _ if self.players[owner].materials < number("repair", "materialCost") as u32 => {
                Some("insufficient-materials")
            }
            _ if self.tactics.as_ref().unwrap().actor_states[actor_id]
                .last_repair_tick
                .is_some_and(|t| self.tick < t + number("repair", "intervalTicks")) =>
            {
                Some("repair-cooldown")
            }
            _ => None,
        });
        if let Some(reason) = reason {
            self.tactical_reject(
                &actor,
                building_id,
                TacticalAction::Repair,
                reason,
                Default::default(),
            );
            return Ok(());
        }
        let index = index.unwrap();
        let target = self.buildings[index].world_position;
        if crate::travel::distance(actor.world_position, target) > number("repair", "rangeMilli") {
            crate::travel::approach_actor(
                &mut actor,
                target,
                1800,
                self.tick,
                self.simulation_version,
            );
            self.tactical_result(
                &actor,
                building_id,
                TacticalAction::Repair,
                TacticalPhase::Approaching,
                Some("out-of-range"),
                Default::default(),
            );
        } else {
            let hp_before = self.buildings[index].hp;
            let materials_before = self.players[owner].materials;
            self.players.get_mut(owner).unwrap().materials -=
                number("repair", "materialCost") as u32;
            let building = &mut self.buildings[index];
            building.hp = (building.hp + number("repair", "healHp") as u32).min(building.max_hp);
            self.tactics
                .as_mut()
                .unwrap()
                .actor_states
                .get_mut(actor_id)
                .unwrap()
                .last_repair_tick = Some(self.tick);
            self.scenario.report.materials_spent += number("repair", "materialCost") as u32;
            actor.state = "repairing".into();
            self.tactical_result(
                &actor,
                building_id,
                TacticalAction::Repair,
                TacticalPhase::Applied,
                None,
                TacticalValues {
                    hp_before: Some(hp_before),
                    hp_after: Some(self.buildings[index].hp),
                    materials_before: Some(materials_before),
                    materials_after: Some(self.players[owner].materials),
                    ..Default::default()
                },
            );
        }
        self.world.entity_mut(entity).insert(actor);
        Ok(())
    }
}
