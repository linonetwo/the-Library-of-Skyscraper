use serde_json::{Value, json};
use std::{
    io::Write,
    process::{Command, Stdio},
};

#[test]
fn decisions_errors_and_timeout_share_one_runner_process() {
    let mut process = Command::new(env!("CARGO_BIN_EXE_skyscraper-arena-script-runner"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    let rules = [
        "var __arenaRule = { decide: ctx => ({intents: [{type:'gather',actorId:'actor-1',priority:ctx.tick}]}) };",
        "var __arenaRule = { decide: () => { throw new Error('rule exploded'); } };",
        "var __arenaRule = { decide: () => { while(true) {} } };",
        "var __arenaRule = { decide: ctx => ({intents: [], time: Date.now(), constructed: +new Date()}) };",
        "var __arenaRule = { decide: () => { const a=[]; while(true) a.push(new Array(100000).fill(1)); } };",
        "var __arenaRule = { decide: () => ({intents: []}) };",
    ];
    let mut input = process.stdin.take().unwrap();
    for code in rules {
        writeln!(
            input,
            "{}",
            json!({"bundle":{"sourceHash":"test","code":code},"context":{"tick":7}})
        )
        .unwrap();
    }
    drop(input);
    let output = process.wait_with_output().unwrap();
    assert!(output.status.success(), "{:?}", output.status);
    let rows: Vec<Value> = String::from_utf8(output.stdout)
        .unwrap()
        .lines()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();
    assert_eq!(rows.len(), 6);
    assert_eq!(rows[0]["decision"]["intents"][0]["priority"], 7);
    assert_eq!(rows[1]["failure"]["kind"], "runtime");
    assert!(
        rows[1]["failure"]["message"]
            .as_str()
            .unwrap()
            .contains("rule exploded")
    );
    assert_eq!(rows[2]["failure"]["kind"], "timeout");
    assert_eq!(rows[3]["decision"]["time"], 3500);
    assert_eq!(rows[3]["decision"]["constructed"], 3500);
    assert_eq!(rows[4]["failure"]["kind"], "heap");
    assert_eq!(rows[5]["decision"]["intents"], json!([]));
}
