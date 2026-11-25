import { RecordedGraphTrace } from "./rule-comparison/RecordedGraphTrace";
import {BehaviorTraceView, readBehaviorTrace} from "./BehaviorFlow";
import { useEffect, useState } from "react";
import { BrainCircuit, ListTodo } from "lucide-react";
import { useArena } from "./ArenaWorkspace";
import { arenaApi } from "./arenaApi";
import type { RuleRuntimeState, ScriptPreview } from "./scriptTypes";
import { taskStatusNames, taskKindNames } from "./ruleLabels";
import "./styles/script-runtime.css";

export function ScriptRuntime() {
  const { session, snapshot } = useArena();
  const [state, setState] = useState<{ sessionId: string; playerId: string; value: RuleRuntimeState }>();
  const [error, setError] = useState("");
  const activeVersion = snapshot?.players.find(player => player.id === session?.playerId)?.script?.sourceHash ?? null;
  useEffect(() => {
    setState(undefined); setError("");
    if (!session) return;
    let current = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const value = await arenaApi.scriptState(session);
        if (current && value.sourceHash === activeVersion) { setState({sessionId:session.sessionId, playerId:session.playerId, value}); setError(""); }
      } catch (cause) { if (current) setError((cause as Error).message); }
      if (current) timer = setTimeout(refresh, 500);
    };
    void refresh();
    return () => { current = false; clearTimeout(timer); };
  }, [session?.sessionId, session?.token, activeVersion]);
  const visibleState = state?.sessionId === session?.sessionId && state?.playerId === session?.playerId
    && state?.value.sourceHash === activeVersion ? state.value : undefined;
  const trace = readBehaviorTrace(visibleState?.memory.aiTrace);
  return <section className="script-runtime" aria-label="规则运行状态">
    <header><div><span className="eyebrow">STRATEGY NOTES</span><h3>规则运行状态</h3></div>
      <small>{activeVersion ? activeVersion.slice(0, 12) : "预设行动"}</small></header>
    <p>版本记忆随策略积累；小队任务在本赛局内延续。此处展示本人小队的计划。</p>
    {error && <p role="alert">{error}</p>}
    {trace && visibleState?.sourceHash && <BehaviorTraceView trace={trace} sourceHash={visibleState.sourceHash} source="已发布版本运行" />}
    {visibleState?.sourceHash && <RecordedGraphTrace key={visibleState.sourceHash} session={session} sourceHash={visibleState.sourceHash} value={visibleState.memory.aiTrace} operationIndex={visibleState.operationIndex} label="已发布运行" />}
    {visibleState ? <div className="script-runtime-grid">
      <div className="script-memory"><h4><BrainCircuit size={15} />规则记忆</h4>
        <pre aria-label="规则记忆">{JSON.stringify(visibleState.memory, null, 2)}</pre></div>
      <div className="script-tasks"><h4><ListTodo size={15} />小队任务 <span>{visibleState.tasks.items.length}</span></h4>
        <ul aria-label="规则任务队列">{visibleState.tasks.items.map(task => <li key={task.id}>
          <div><strong>{taskKindNames[task.kind]}</strong><span data-status={task.status}>{taskStatusNames[task.status]}</span></div>
          <small>{task.actorId} → {snapshot?.rooms.find(room => room.id === task.roomId)?.name ?? task.roomId}</small>
          {task.blockedReason && <p>{task.blockedReason}</p>}
          <small>优先级 {task.priority} · T{task.updatedAtTick} · {task.sourceHash.slice(0, 8)}</small>
        </li>)}</ul>
        {!visibleState.tasks.items.length && <p>载入「记忆采集计划」，观察小队逐步积累计划。</p>}
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
    <details><summary>查看原始状态补丁</summary><pre>{JSON.stringify({ memoryPatch: decision.memoryPatch, taskPatches: decision.taskPatches }, null, 2)}</pre></details>
  </section>;
}
