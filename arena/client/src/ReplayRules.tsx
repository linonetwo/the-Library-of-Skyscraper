import {BehaviorTraceView,readBehaviorTrace} from "./BehaviorFlow";
import { useMemo, useState } from "react";
import { projectRuleHistory } from "./replayRuleState";
import type { ReplayFrame, ReplayTimeline } from "./useReplay";
import { taskStatusNames, taskKindNames } from "./ruleLabels";
import "./styles/replay-rules.css";

export default function ReplayRules({ timeline, frame, onSeek }: {
  timeline: ReplayTimeline; frame: ReplayFrame; onSeek: (index: number) => void;
}) {
  const history = timeline.ruleHistory;
  const hash = frame.snapshot.players.find(player => player.id === history?.playerId)?.script?.sourceHash ?? null;
  const state = useMemo(() => history && projectRuleHistory(history, frame.operationIndex, hash),
    [history, frame.operationIndex, hash]);
  const [selection, setSelection] = useState("");
  const trace = readBehaviorTrace(state?.memory.aiTrace);
  const selected = state?.tasks.find(item => item.task.id === selection);
  return <section className="replay-rules" aria-label="回放规则状态">
    <header><div><span className="eyebrow">STRATEGY CHRONICLE</span><h3>小队计划 · 回放</h3></div>
      <small>操作 {frame.operationIndex} · T{frame.tick}</small></header>
    {state ? <>
      <p>版本 {hash?.slice(0, 12) ?? "预设行动"} · 随录制操作展示本人的策略记忆与任务。</p>
      {trace && hash && <BehaviorTraceView trace={trace} sourceHash={hash} source="回放" />}
      <div className="replay-rules-grid">
        <div><h4>版本记忆</h4><pre aria-label="回放规则记忆">{JSON.stringify(state.memory, null, 2)}</pre></div>
        <div><h4>小队任务 <span>{state.tasks.length}</span></h4>
          <ul aria-label="回放任务队列">{state.tasks.map(({ task }) => <li key={task.id}>
            <button aria-pressed={selection === task.id} onClick={() => setSelection(task.id)}>
              <strong>{taskKindNames[task.kind]}</strong><span>{taskStatusNames[task.status]}</span>
              <small>{task.actorId} → {frame.snapshot.rooms.find(room => room.id === task.roomId)?.name ?? task.roomId}</small>
            </button>
          </li>)}</ul>
          {!state.tasks.length && <p>此时小队尚无任务记录。</p>}
        </div>
      </div>
      {selected && <article className="replay-task-source" aria-label="回放任务详情">
        <strong>{selected.task.id}</strong>
        <p>{selected.task.actorId} · 优先级 {selected.task.priority} · {taskStatusNames[selected.task.status]}</p>
        {selected.task.blockedReason && <p>{selected.task.blockedReason}</p>}
        <p>来源 {selected.task.sourceHash.slice(0, 12)} · T{selected.task.updatedAtTick} · 操作 {selected.operationIndex}</p>
        <button onClick={() => onSeek(selected.operationIndex)}>定位任务来源</button>
      </article>}
    </> : <p>此回放未记录私有状态。</p>}
  </section>;
}
