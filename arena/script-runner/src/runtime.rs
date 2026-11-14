use crate::protocol::{Failure, Request, Response, ScriptEngineAdapter};
use deno_core::{JsRuntime, RuntimeOptions, v8};
use std::{
    sync::{
        Arc,
        atomic::{AtomicU8, Ordering},
        mpsc,
    },
    time::{Duration, Instant},
};

pub struct V8Adapter {
    pub execution_limit: Duration,
    pub heap_limit_bytes: usize,
    reactor: tokio::runtime::Runtime,
}

impl Default for V8Adapter {
    fn default() -> Self {
        Self {
            execution_limit: Duration::from_millis(100),
            heap_limit_bytes: 32 * 1024 * 1024,
            reactor: tokio::runtime::Builder::new_multi_thread()
                .worker_threads(1)
                .enable_time()
                .build()
                .expect("V8 background task reactor"),
        }
    }
}

impl ScriptEngineAdapter for V8Adapter {
    fn execute(&self, request: Request) -> Response {
        let started = Instant::now();
        let _reactor = self.reactor.enter();
        let mut runtime = JsRuntime::new(RuntimeOptions {
            create_params: Some(v8::CreateParams::default().heap_limits(0, self.heap_limit_bytes)),
            ..Default::default()
        });
        // The first termination cause owns the result: 1 = time, 2 = heap.
        let cause = Arc::new(AtomicU8::new(0));
        let heap_cause = cause.clone();
        let heap_handle = runtime.v8_isolate().thread_safe_handle();
        runtime.add_near_heap_limit_callback(move |current, _| {
            let _ = heap_cause.compare_exchange(0, 2, Ordering::SeqCst, Ordering::SeqCst);
            heap_handle.terminate_execution();
            // Allow V8 to unwind the interrupted allocation instead of aborting.
            current + 16 * 1024 * 1024
        });
        let timer_handle = runtime.v8_isolate().thread_safe_handle();
        let timer_cause = cause.clone();
        let deadline = self.execution_limit;
        let (done, completion) = mpsc::channel();
        let timer = std::thread::spawn(move || {
            if completion.recv_timeout(deadline).is_err() {
                let _ = timer_cause.compare_exchange(0, 1, Ordering::SeqCst, Ordering::SeqCst);
                timer_handle.terminate_execution();
            }
        });
        let result = evaluate(&mut runtime, &request);
        let _ = done.send(());
        timer.join().expect("execution timer thread");
        let failure = match cause.load(Ordering::SeqCst) {
            1 => Some(Failure {
                kind: "timeout".into(),
                message: "Rule execution exceeded its tick budget".into(),
            }),
            2 => Some(Failure {
                kind: "heap".into(),
                message: "Rule execution reached its V8 heap budget".into(),
            }),
            _ => result.as_ref().err().map(|message| Failure {
                kind: "runtime".into(),
                message: message.clone(),
            }),
        };
        Response {
            decision: if failure.is_none() { result.ok() } else { None },
            failure,
            duration_ms: started.elapsed().as_secs_f64() * 1000.0,
        }
    }
}

fn evaluate(runtime: &mut JsRuntime, request: &Request) -> Result<serde_json::Value, String> {
    let context_json = serde_json::to_string(&request.context).map_err(|e| e.to_string())?;
    let context_literal = serde_json::to_string(&context_json).map_err(|e| e.to_string())?;
    let bootstrap = format!(
        "globalThis.__arenaContext = JSON.parse({context_literal});\n{}",
        include_str!("platform.js")
    );
    runtime
        .execute_script("arena:platform", bootstrap)
        .map_err(|e| e.to_string())?;
    runtime
        .execute_script("arena:bundle", request.bundle.code.clone())
        .map_err(|e| e.to_string())?;
    let output = runtime
        .execute_script(
            "arena:decide",
            "__arenaSerialize(__arenaRule.decide(__arenaContext))",
        )
        .map_err(|e| e.to_string())?;
    deno_core::scope!(scope, runtime);
    let local = v8::Local::new(scope, output);
    let serialized = local.to_rust_string_lossy(scope);
    serde_json::from_str(&serialized).map_err(|e| e.to_string())
}
