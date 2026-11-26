use serde_json::{Value, json};
use std::{
    io::Write,
    process::{Command, Stdio},
};

fn request(skill: Option<&str>, intents: Value) -> Value {
    let skill = skill
        .map(|body| format!(", chantInkStrike(input,api) {{ {body} }}"))
        .unwrap_or_default();
    json!({"bundle":{"sourceHash":"authored-bundle-version","code":format!("var __arenaRule = {{decide(ctx) {{ctx.world.enemies[0].hp=999;return {{intents:{intents},chants:[{{steps:['fake']}}]}};}}{skill}}};")},"context":{"tick":17,"world":{"enemies":[{"id":"enemy-1","roomId":"room-3","hp":60}]}}})
}
fn casts() -> Value {
    json!([{"type":"gather","actorId":"gatherer","priority":1}, {"type":"cast","actorId":"guard","targetId":"enemy-1","skillId":"ink-strike","priority":2}])
}
fn execute(requests: &[Value]) -> Vec<Value> {
    let mut process = Command::new(env!("CARGO_BIN_EXE_skyscraper-arena-script-runner"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    let mut stdin = process.stdin.take().unwrap();
    for request in requests {
        writeln!(stdin, "{request}").unwrap();
    }
    drop(stdin);
    let output = process.wait_with_output().unwrap();
    assert!(output.status.success());
    String::from_utf8(output.stdout)
        .unwrap()
        .lines()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect()
}
#[test]
fn private_chants_bind_original_intent_and_snapshot() {
    let rows = execute(&[
        request(None, casts()),
        request(
            Some(
                "const observation=api.observe();if(observation.hp===60)api.seal(api.channel(observation));",
            ),
            casts(),
        ),
        request(Some("api.channel(api.observe());"), casts()),
        request(
            Some("return {chants:[{op:'observe'},{op:'channel',from:0},{op:'seal',from:1}]};"),
            casts(),
        ),
        request(Some("api.seal(api.channel({enemyId:'enemy-1'}));"), casts()),
        request(Some("throw new Error('skill failed');"), casts()),
        request(Some("while(true){}"), casts()),
        request(
            Some("throw new Error('unused');"),
            json!([{"type":"gather","actorId":"gatherer","priority":1}]),
        ),
    ]);
    for row in &rows[..6] {
        assert_eq!(row["decision"]["intents"][0]["type"], "gather");
    }
    let official = &rows[0]["chants"][0];
    assert_eq!(official["intentIndex"], 1);
    assert_eq!(official["actorId"], "guard");
    assert_eq!(official["targetId"], "enemy-1");
    assert_eq!(official["observedTick"], 17);
    assert_eq!(
        official["skillSourceHash"],
        "441286bde12c417312258ecd0c12f698fbe9fbceba8139fc09e51cffe9dfd4e8"
    );
    assert_eq!(
        official["steps"],
        json!([{"op":"observe"},{"op":"channel","from":0},{"op":"seal","from":1}])
    );
    assert!(official.get("reasonCode").is_none());
    assert_eq!(
        rows[1]["chants"][0]["skillSourceHash"],
        "authored-bundle-version"
    );
    assert_eq!(rows[1]["chants"][0]["steps"], official["steps"]);
    for row in &rows[2..5] {
        assert_eq!(row["chants"][0]["reasonCode"], "chant-mismatch");
    }
    assert_eq!(rows[3]["chants"][0]["steps"], json!([]));
    assert_eq!(rows[5]["chants"][0]["reasonCode"], "chant-error");
    assert_eq!(rows[6]["failure"]["kind"], "timeout");
    assert!(rows[6].get("decision").is_none());
    assert!(rows[6].get("chants").is_none());
    assert!(rows[7].get("chants").is_none());
    assert!(rows[7].get("failure").is_none());
}
#[test]
fn invocation_products_cannot_cross_casts_and_records_are_bounded() {
    let mut intents = casts();
    intents.as_array_mut().unwrap().push(json!({"type":"cast","actorId":"scout","targetId":"enemy-1","skillId":"ink-strike","priority":1}));
    let rows = execute(&[
        request(
            Some(
                "if(input.actorId==='guard'){globalThis.savedObservation=api.observe();api.seal(api.channel(savedObservation));}else{api.seal(api.channel(savedObservation));}",
            ),
            intents,
        ),
        request(Some("for(let n=0;n<100;n++)api.observe();"), casts()),
    ]);
    assert!(rows[0]["chants"][0].get("reasonCode").is_none());
    assert_eq!(rows[0]["chants"][1]["intentIndex"], 2);
    assert_eq!(rows[0]["chants"][1]["reasonCode"], "chant-mismatch");
    assert_eq!(rows[1]["chants"][0]["steps"].as_array().unwrap().len(), 8);
    assert_eq!(rows[1]["chants"][0]["reasonCode"], "chant-mismatch");
}

#[test]
fn compiled_project_fixtures_use_the_same_worker_abi() {
    let fixture: Value = serde_json::from_str(include_str!("fixtures/chant-mixed.json")).unwrap();
    let fixtures = fixture["fixtures"].as_array().unwrap();
    let requests: Vec<_> = fixtures
        .iter()
        .map(|fixture| fixture["request"].clone())
        .collect();
    let responses = execute(&requests);
    for (fixture, actual) in fixtures.iter().zip(responses) {
        assert_eq!(
            actual["decision"], fixture["response"]["decision"],
            "{}",
            fixture["name"]
        );
        assert_eq!(
            actual["chants"], fixture["response"]["chants"],
            "{}",
            fixture["name"]
        );
        assert!(actual.get("failure").is_none());
    }
}
