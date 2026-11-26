use super::*;
#[test]
fn last_material_and_last_hp_resolve_atomically_in_command_order() {
    for hp in [70, 99] {
        let mut s = game(Mode::Training);
        s.tick = 4;
        let target = s
            .buildings
            .iter()
            .position(|b| b.id == "p1-drill-warehouse")
            .unwrap();
        s.buildings[target].hp = hp;
        s.players.get_mut("p1").unwrap().materials = 1;
        place(&mut s, "p1-scout", "room-3", -9.4, 8.);
        place(&mut s, "p1-guard", "room-3", -9.3, 8.);
        repair(&mut s, "p1-scout", "p1-drill-warehouse");
        assert_eq!(s.players["p1"].materials, 0);
        assert_eq!(s.buildings[target].hp, (hp + 4).min(100));
        assert_eq!(result(&s).values.materials_before, Some(1));
        assert_eq!(result(&s).values.materials_after, Some(0));
        let healed = s.buildings[target].hp;
        repair(&mut s, "p1-guard", "p1-drill-warehouse");
        assert_eq!(
            result(&s).reason_code.as_deref(),
            Some(if hp == 99 {
                "building-full"
            } else {
                "insufficient-materials"
            })
        );
        assert_eq!(s.buildings[target].hp, healed);
        assert_eq!(s.players["p1"].materials, 0);
    }
}
#[test]
fn approach_and_cooldown_keep_cost_and_hp_unchanged_until_repair() {
    let mut s = game(Mode::Training);
    s.tick = 4;
    let b = s
        .buildings
        .iter()
        .position(|b| b.id == "p1-drill-warehouse")
        .unwrap();
    s.buildings[b].hp = 70;
    place(&mut s, "p1-scout", "room-3", -8., 5.1);
    let start = actor(&mut s, "p1-scout").world_position;
    let stock = s.players["p1"].materials;
    repair(&mut s, "p1-scout", "p1-drill-warehouse");
    assert_eq!(result(&s).phase, TacticalPhase::Approaching);
    assert!(crate::travel::distance(start, actor(&mut s, "p1-scout").world_position) <= 750);
    assert_eq!(s.players["p1"].materials, stock);
    assert_eq!(s.buildings[b].hp, 70);
    assert_eq!(
        s.tactics.as_ref().unwrap().actor_states["p1-scout"].last_repair_tick,
        None
    );
    place(&mut s, "p1-scout", "room-3", -9.4, 8.);
    s.tick = 5;
    repair(&mut s, "p1-scout", "p1-drill-warehouse");
    assert_eq!(s.buildings[b].hp, 74);
    s.tick = 6;
    repair(&mut s, "p1-scout", "p1-drill-warehouse");
    assert_eq!(result(&s).reason_code.as_deref(), Some("repair-cooldown"));
    assert_eq!(s.buildings[b].hp, 74);
    assert_eq!(s.players["p1"].materials, stock - 1);
}
#[test]
fn foreign_destroyed_incomplete_full_and_no_stock_never_change_numbers() {
    for reason in [
        "building-not-owned",
        "building-destroyed",
        "building-incomplete",
        "building-full",
        "insufficient-materials",
    ] {
        let mut s = game(Mode::Online);
        s.tick = 4;
        place(&mut s, "p1-scout", "room-3", -9.4, 8.);
        let i = s
            .buildings
            .iter()
            .position(|b| b.id == "p1-drill-warehouse")
            .unwrap();
        s.buildings[i].hp = 70;
        match reason {
            "building-not-owned" => s.buildings[i].owner = "p2".into(),
            "building-destroyed" => s.buildings[i].hp = 0,
            "building-incomplete" => s.buildings[i].required_ticks = 16,
            "building-full" => s.buildings[i].hp = 100,
            _ => s.players.get_mut("p1").unwrap().materials = 0,
        }
        let before = (s.buildings[i].hp, s.players["p1"].materials);
        repair(&mut s, "p1-scout", "p1-drill-warehouse");
        assert_eq!(result(&s).reason_code.as_deref(), Some(reason));
        assert_eq!((s.buildings[i].hp, s.players["p1"].materials), before);
    }
}
