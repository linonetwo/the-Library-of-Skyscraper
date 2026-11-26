//! Native, invocation-local evidence. Returned rule JSON cannot populate this collector.
use crate::protocol::{ChantRecord, ChantStep, Request};
use deno_core::{JsRuntime, v8};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{cell::RefCell, rc::Rc};

const OFFICIAL: &str = include_str!("../../script-sdk/skills/ink-strike.js");
const STEP_LIMIT: usize = 8;
struct Invocation {
    record: ChantRecord,
    observation: Value,
    products: Vec<(usize, v8::Global<v8::Value>)>,
}
type Collector = Rc<RefCell<Invocation>>;

fn step(scope: &mut v8::PinScope, args: v8::FunctionCallbackArguments, mut rv: v8::ReturnValue) {
    let Some(collector) = scope.get_slot::<Collector>().cloned() else {
        return;
    };
    let encoded = args.data().uint32_value(scope).unwrap_or(u32::MAX) as usize;
    let mut current = collector.borrow_mut();
    if encoded / 3 != current.record.intent_index || current.record.steps.len() >= STEP_LIMIT {
        current.record.reason_code = Some("chant-mismatch".into());
        return;
    }
    let op = encoded % 3;
    let from = if op == 0 {
        None
    } else {
        current
            .products
            .iter()
            .find(|(_, product)| v8::Local::new(scope, product).strict_equals(args.get(0)))
            .map(|(index, _)| *index)
    };
    let valid = match op {
        0 => true,
        1 => from.is_some_and(|index| current.record.steps[index].op == "observe"),
        _ => from.is_some_and(|index| current.record.steps[index].op == "channel"),
    };
    if !valid {
        current.record.reason_code = Some("chant-mismatch".into());
    }
    let index = current.record.steps.len();
    current.record.steps.push(ChantStep {
        op: ["observe", "channel", "seal"][op].into(),
        from,
    });
    if op < 2 {
        let value = if op == 0 {
            let text = v8::String::new(scope, &current.observation.to_string()).unwrap();
            v8::json::parse(scope, text).unwrap()
        } else {
            v8::Object::new(scope).into()
        };
        current
            .products
            .push((index, v8::Global::new(scope, value)));
        rv.set(value);
    }
}

pub fn collect(
    runtime: &mut JsRuntime,
    request: &Request,
    decision: &Value,
) -> Result<Option<Vec<ChantRecord>>, String> {
    let casts: Vec<_> = decision
        .get("intents")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .enumerate()
        .filter(|(_, intent)| intent["type"] == "cast" && intent["skillId"] == "ink-strike")
        .collect();
    if casts.is_empty() {
        return Ok(None);
    }
    // These bytes are loaded only for actual casts. The official export is captured by Rust.
    let official_code = format!(
        "(function(){{ {} ; return chantInkStrike; }})()",
        OFFICIAL.replace("export function", "function")
    );
    let official = runtime
        .execute_script("arena:official-ink-strike", official_code)
        .map_err(|e| e.to_string())?;
    let authored = runtime
        .execute_script("arena:skill-export", "__arenaRule.chantInkStrike")
        .map_err(|e| e.to_string())?;
    let mut records = Vec::new();
    for (intent_index, intent) in casts {
        let actor_id = intent["actorId"].as_str().unwrap_or_default().to_owned();
        let target_id = intent["targetId"].as_str().unwrap_or_default().to_owned();
        let tick = request.context["tick"].as_u64().unwrap_or_default();
        let enemy = request
            .context
            .pointer("/world/enemies")
            .and_then(Value::as_array)
            .and_then(|enemies| enemies.iter().find(|enemy| enemy["id"] == target_id));
        let observation = json!({"enemyId":target_id,"roomId":enemy.and_then(|enemy| enemy.get("roomId")),"hp":enemy.and_then(|enemy| enemy["hp"].as_f64()).unwrap_or(0.0)});
        let is_authored;
        let collector;
        {
            deno_core::scope!(scope, runtime);
            let authored = v8::Local::new(scope, &authored);
            is_authored = authored.is_function();
            let function = v8::Local::<v8::Function>::try_from(if is_authored {
                authored
            } else {
                v8::Local::new(scope, &official)
            })
            .map_err(|_| "Official chant is not callable".to_string())?;
            collector = Rc::new(RefCell::new(Invocation {
                record: ChantRecord {
                    intent_index,
                    actor_id: actor_id.clone(),
                    target_id: target_id.clone(),
                    observed_tick: tick,
                    skill_source_hash: if is_authored {
                        request.bundle.source_hash.clone()
                    } else {
                        format!("{:x}", Sha256::digest(OFFICIAL.as_bytes()))
                    },
                    steps: Vec::new(),
                    reason_code: None,
                },
                observation,
                products: Vec::new(),
            }));
            scope.set_slot(collector.clone());
            let input_text = v8::String::new(
                scope,
                &json!({"actorId":actor_id,"targetId":target_id,"tick":tick}).to_string(),
            )
            .unwrap();
            let input = v8::json::parse(scope, input_text).unwrap();
            let api = v8::Object::new(scope);
            for (op, name) in ["observe", "channel", "seal"].iter().enumerate() {
                let key = v8::String::new(scope, name).unwrap();
                let data = v8::Integer::new_from_unsigned(scope, (intent_index * 3 + op) as u32);
                let callback = v8::Function::builder(step)
                    .data(data.into())
                    .build(scope)
                    .unwrap();
                api.set(scope, key.into(), callback.into());
            }
            let receiver = v8::undefined(scope).into();
            v8::tc_scope!(let caught, scope);
            let result = function.call(caught, receiver, &[input, api.into()]);
            if caught.has_terminated() {
                return Err("Chant execution terminated".into());
            }
            if result.is_none() || result.is_some_and(|result| result.is_promise()) {
                collector.borrow_mut().record.reason_code = Some("chant-error".into());
            }
        }
        runtime.v8_isolate().remove_slot::<Collector>();
        let mut record = collector.borrow().record.clone();
        let recipe = [
            ChantStep {
                op: "observe".into(),
                from: None,
            },
            ChantStep {
                op: "channel".into(),
                from: Some(0),
            },
            ChantStep {
                op: "seal".into(),
                from: Some(1),
            },
        ];
        if record.steps != recipe && record.reason_code.is_none() {
            record.reason_code = Some("chant-mismatch".into());
        }
        records.push(record);
    }
    Ok(Some(records))
}
