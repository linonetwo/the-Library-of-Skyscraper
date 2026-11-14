import { useEffect, useState } from "react";
import { BrainCircuit, ListTodo } from "lucide-react";
import { useArena } from "./ArenaWorkspace";
import { arenaApi } from "./arenaApi";
import type { RuleRuntimeState, ScriptPreview } from "./scriptTypes";
import "./styles/script-runtime.css";

const statuses = { queued: "待执行", running: "进行中", blocked: "等待条件", completed: "已完成", failed: "失败", cancelled: "已取消" };
const kinds = { move: "前往", gather: "采集", deliver: "入库", build: "建造", attack: "攻击", capture: "编目" };

export function ScriptRuntime() {
  const { session, snapshot } = useArena();
  const [state, setState] = useState<RuleRuntimeState>();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!session) return;
    let current = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const value = await arenaApi.scriptState(session);
        if (current) { setState(value); setError(""); }
      } catch (cause) { if (current) setError((cause as Error).message); }
      if (current) timer = setTimeout(refresh, 500);
    };
    void refresh();
    return () => { current = false; clearTimeout(timer); };
  }, [session]);
  return <section className="script-runtime" aria-label="规则运行状态">
    <header><div><span className="eyebrow">STRATEGY NOTES</span><h3>规则运行状态</h3></div>
      <small>{state?.sourceHash ? state.sourceHash.slice(0, 12) : "预设行动"}</small></header>
    <p>版本记忆随策略积累；小队任务在本赛局内延续。此处展示本人小队的计划。</p>
    {error && <p role="alert">{error}</p>}
    {state ? <div className="script-runtime-grid">
      <div className="script-memory"><h4><BrainCircuit size={15} />规则记忆</h4>
        <pre aria-label="规则记忆">{JSON.stringify(state.memory, null, 2)}</pre></div>
      <div className="script-tasks"><h4><ListTodo size={15} />小队任务 <span>{state.tasks.items.length}</span></h4>
        <ul aria-label="规则任务队列">{state.tasks.items.map(task => <li key={task.id}>
          <div><strong>{kinds[task.kind]}</strong><span data-status={task.status}>{statuses[task.status]}</span></div>
          <small>{task.actorId} → {snapshot?.rooms.find(room => room.id === task.roomId)?.name ?? task.roomId}</small>
          {task.blockedReason && <p>{task.blockedReason}</p>}
          <small>优先级 {task.priority} · T{task.updatedAtTick} · {task.sourceHash.slice(0, 8)}</small>
        </li>)}</ul>
        {!state.tasks.items.length && <p>载入「记忆采集计划」，观察小队逐步积累计划。</p>}
      </div>
    </div> : <p>正在展开策略笔记…</p>}
  </section>;
}

export function PreviewStatePatch({ preview }: { preview: ScriptPreview }) {
  const decision = preview.execution?.decision;
  if (!decision?.memoryPatch && !decision?.taskPatches?.length) return null;
  return <section className="script-preview-patch" aria-label="试跑状态补丁">
    <h4>试跑计划 · {preview.sourceHash?.slice(0, 12)}</h4>
    <p>以下为当前快照的试算。正式运行时，每步重新计算并提交计划。</p>
    <pre>{JSON.stringify({ memoryPatch: decision.memoryPatch, taskPatches: decision.taskPatches }, null, 2)}</pre>
  </section>;
}
