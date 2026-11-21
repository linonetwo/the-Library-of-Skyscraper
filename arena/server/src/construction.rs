use crate::{Actor, Building, Session};
impl Session {
    pub(crate) fn build_with_actor(
        &mut self,
        owner: &str,
        actor_id: &str,
        room: &str,
        kind: &str,
    ) -> Result<(), String> {
        let (e, mut a) = self.actor(owner, actor_id)?;
        if a.room_id != room {
            return Err("builder must be in the target room".into());
        }
        self.ensure_site(owner, room, kind)?;
        a.task = Some(crate::ActorTask {
            kind: "build".into(),
            target: room.into(),
            stage: "construction".into(),
            blocked_reason: None,
            building_kind: Some(kind.into()),
        });
        self.world.entity_mut(e).insert(a);
        Ok(())
    }

    pub(crate) fn ensure_site(
        &mut self,
        owner: &str,
        room: &str,
        kind: &str,
    ) -> Result<(), String> {
        if !["tower", "catalog", "warehouse"].contains(&kind) {
            return Err("invalid building kind".into());
        }
        if kind == "catalog" && room != crate::scenario::config()["targetRoomId"].as_str().unwrap()
        {
            return Err("catalog must be built at objective room-3".into());
        }
        if self.enemies.iter().any(|e| e.room_id == room && e.hp > 0) {
            return Err("请先清除工地守卫".into());
        }
        if let Some(b) = self
            .buildings
            .iter()
            .find(|b| b.owner == owner && b.room_id == room && b.kind == kind && b.hp > 0)
        {
            return if b.construction_ticks >= b.required_ticks {
                Err("建筑已完成".into())
            } else {
                Ok(())
            };
        }
        let cfg = crate::scenario::config();
        let cost = cfg["buildingCosts"][kind].as_u64().unwrap() as u32;
        let player = self.players.get_mut(owner).unwrap();
        if player.materials < cost {
            return Err(format!("需 {cost} 建材入库后施工"));
        }
        player.materials -= cost;
        self.scenario.report.materials_spent += cost;
        let hp = cfg["buildingHp"][kind].as_u64().unwrap() as u32;
        self.buildings.push(Building {
            id: format!("building-{}", self.buildings.len() + 1),
            owner: owner.into(),
            room_id: room.into(),
            kind: kind.into(),
            hp,
            max_hp: hp,
            construction_ticks: 0,
            required_ticks: crate::scenario::number("constructionTicks") as u32,
        });
        self.event(
            "construction",
            format!("{room} {kind} 扣除 {cost} 建材，开始8秒施工"),
            Some(owner),
        );
        Ok(())
    }
    pub(crate) fn construction_tick(&mut self) {
        let actors: Vec<_> = self
            .world
            .query::<&Actor>()
            .iter(&self.world)
            .cloned()
            .collect();
        let mut done = vec![];
        for b in &mut self.buildings {
            if b.hp == 0 || b.construction_ticks >= b.required_ticks {
                continue;
            }
            if actors.iter().any(|a| {
                a.hp > 0
                    && !a.retreating
                    && a.travel.is_none()
                    && a.owner == b.owner
                    && a.room_id == b.room_id
                    && a.task.as_ref().is_some_and(|t| {
                        t.kind == "build" && t.building_kind.as_deref() == Some(&b.kind)
                    })
            }) {
                b.construction_ticks += 1;
                if b.construction_ticks == b.required_ticks {
                    done.push((b.owner.clone(), b.kind.clone(), b.room_id.clone()));
                }
            }
        }
        for (owner, kind, room) in done {
            self.event("build", format!("{room} {kind} 施工完成"), Some(&owner));
        }
    }
}
