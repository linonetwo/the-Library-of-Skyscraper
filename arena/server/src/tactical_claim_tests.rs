use super::*;
#[test]
fn same_side_counts_once_opponents_reset_then_six_ticks_transfer_and_recapture() {
    let mut s = game(Mode::Online);
    place(&mut s, "p1-guard", "room-2", 0., 8.);
    place(&mut s, "p1-scout", "room-2", 1., 8.);
    place(&mut s, "p2-guard", "room-2", 0., 9.);
    claim(&mut s, "p1", "p1-guard");
    claim(&mut s, "p1", "p1-scout");
    for _ in 0..3 {
        s.advance();
    }
    assert_eq!(
        s.tactics.as_ref().unwrap().control_points["room-2"].progress_ticks,
        0,
        "enemy presence blocks even without a claim task"
    );
    place(&mut s, "p2-guard", "room-0", 0., 0.);
    for _ in 0..5 {
        s.advance();
    }
    assert_eq!(s.rooms[2].owner, None);
    assert_eq!(
        s.tactics.as_ref().unwrap().control_points["room-2"].progress_ticks,
        5
    );
    claim(&mut s, "p1", "p1-guard");
    s.advance();
    assert_eq!(s.rooms[2].owner.as_deref(), Some("p1"));
    assert_eq!(
        s.players["p1"].score, 1,
        "multiple same-owner claimants are not extra scoring votes"
    );
    let stock = s.players["p1"].materials;
    let facilities = s
        .buildings
        .iter()
        .map(|b| (b.id.clone(), b.owner.clone()))
        .collect::<Vec<_>>();
    place(&mut s, "p1-guard", "room-0", 0., 0.);
    place(&mut s, "p1-scout", "room-0", 1., 0.);
    place(&mut s, "p2-guard", "room-2", 0., 8.);
    claim(&mut s, "p2", "p2-guard");
    for _ in 0..6 {
        s.advance();
    }
    assert_eq!(s.rooms[2].owner.as_deref(), Some("p2"));
    assert_eq!(s.players["p1"].materials, stock);
    assert_eq!(
        s.buildings
            .iter()
            .map(|b| (b.id.clone(), b.owner.clone()))
            .collect::<Vec<_>>(),
        facilities
    );
    place(&mut s, "p2-guard", "room-0", 0., 0.);
    place(&mut s, "p1-guard", "room-2", 0., 8.);
    claim(&mut s, "p1", "p1-guard");
    for _ in 0..6 {
        s.advance();
    }
    assert_eq!(s.rooms[2].owner.as_deref(), Some("p1"));
}
#[test]
fn pve_and_absent_claimants_clear_incomplete_progress_not_owner() {
    let mut s = game(Mode::Training);
    place(&mut s, "p1-guard", "room-2", 0., 8.);
    claim(&mut s, "p1", "p1-guard");
    for _ in 0..3 {
        s.advance();
    }
    assert_eq!(
        s.tactics.as_ref().unwrap().control_points["room-2"].progress_ticks,
        3
    );
    s.enemies[0].room_id = "room-2".into();
    s.enemies[0].world_position = Position { x: 0., y: 9. };
    s.advance();
    assert_eq!(
        s.tactics.as_ref().unwrap().control_points["room-2"].progress_ticks,
        0
    );
    assert_eq!(s.rooms[2].owner, None);
    assert_eq!(
        s.snapshot().tactics.unwrap().control_points[0]
            .blocked_reason
            .as_deref(),
        Some("point-defended")
    );
    s.enemies[0].hp = 0;
    place(&mut s, "p1-guard", "room-2", 0., 8.); // This fixture deliberately removes the claim task.
    s.advance();
    assert_eq!(
        s.tactics.as_ref().unwrap().control_points["room-2"].progress_ticks,
        0
    );
}
#[test]
fn owned_point_scores_only_with_active_claim_and_times_out_by_real_score() {
    let mut s = game(Mode::Training);
    place(&mut s, "p1-guard", "room-2", 0., 8.);
    claim(&mut s, "p1", "p1-guard");
    for _ in 0..25 {
        s.advance();
    }
    assert_eq!(s.players["p1"].score, 20);
    assert_eq!(s.result.as_ref().unwrap().winner, "p1");
    let mut tied = game(Mode::Online);
    tied.tick = 959;
    tied.advance();
    assert_eq!(tied.result.as_ref().unwrap().winner, "");
    let mut leading = game(Mode::Online);
    leading.tick = 959;
    leading.players.get_mut("p2").unwrap().score = 2;
    leading.advance();
    assert_eq!(leading.result.as_ref().unwrap().winner, "p2");
}
