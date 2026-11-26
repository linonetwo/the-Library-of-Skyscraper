use crate::{ScenarioId, TacticalEvent, TacticalSnapshot};

#[test]
fn tactical_public_wire_roundtrips_the_exact_contract_fixture() {
    let examples: serde_json::Value =
        serde_json::from_str(include_str!("../tests/fixtures/tactics-wire.json")).unwrap();
    let view: TacticalSnapshot = serde_json::from_value(examples["tactics"].clone()).unwrap();
    assert_eq!(serde_json::to_value(view).unwrap(), examples["tactics"]);
    for key in ["repairEvent", "rejectedAttackEvent"] {
        let event: TacticalEvent = serde_json::from_value(examples[key].clone()).unwrap();
        assert_eq!(serde_json::to_value(event).unwrap(), examples[key]);
    }
    assert_eq!(
        serde_json::to_value(ScenarioId::SealContest).unwrap(),
        examples["create"]["scenarioId"]
    );
}
