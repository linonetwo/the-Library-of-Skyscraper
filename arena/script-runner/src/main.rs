use skyscraper_arena_script_runner::{
    protocol::{Failure, Request, Response, ScriptEngineAdapter},
    runtime::V8Adapter,
};
use std::io::{self, BufRead, Write};

fn main() -> io::Result<()> {
    let engine = V8Adapter::default();
    let stdin = io::stdin();
    let mut stdout = io::stdout().lock();
    for line in stdin.lock().lines() {
        let response = match serde_json::from_str::<Request>(&line?) {
            Ok(request) => engine.execute(request),
            Err(error) => Response {
                decision: None,
                failure: Some(Failure {
                    kind: "protocol".into(),
                    message: error.to_string(),
                }),
                duration_ms: 0.0,
            },
        };
        serde_json::to_writer(&mut stdout, &response)?;
        writeln!(stdout)?;
        stdout.flush()?;
    }
    Ok(())
}
