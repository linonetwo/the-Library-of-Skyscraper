import { useState } from "react";
import { useArena } from "./ArenaWorkspace";
import { arenaApi } from "./arenaApi";
import { getModuleSourceRef } from "../../behavior-modules";
import "./styles/behavior-workbench.css";
import type { BehaviorPlan } from "../../behavior-modules";
import { moduleNames } from "./BehaviorModuleCard";
export interface BehaviorTrace {
  v: 1;
  tick: number;
  actors: {
    actorId: string;
    moduleId: string;
    visited: string[];
    reason: string;
  }[];
}
export function BehaviorTraceView({
  trace,
  sourceHash,
  source,
  onLocate,
}: {
  trace: BehaviorTrace;
  sourceHash: string;
  source: "试跑当前草稿" | "已发布版本运行" | "回放";
  onLocate?: (moduleId: string) => void;
}) {
  const { session } = useArena();
  const [sourceText, setSourceText] = useState<{
    hash: string;
    text: string;
  }>();
  const inspect = async (id: string) => {
    if (onLocate) return onLocate(id);
    if (!session) return;
    try {
      const version = await arenaApi.scriptVersion(session, sourceHash);
      const ref = getModuleSourceRef(version.project, id);
      setSourceText({
        hash: sourceHash,
        text: ref
          ? `${ref.file}:${ref.line}\n${version.project.files[ref.file].split("\n")[ref.line - 1]}`
          : "此版本没有可定位的官方模块源码。",
      });
    } catch (cause) {
      setSourceText({ hash: sourceHash, text: (cause as Error).message });
    }
  };
  return (
    <section className="behavior-trace" aria-label={`${source}决策路径`}>
      <h4>
        {source} · T{trace.tick} · {sourceHash.slice(0, 12)}
      </h4>
      <p>以下为决策选择；动作是否生效请查看战场事件。</p>
      {trace.actors.map((actor) => (
        <div key={actor.actorId}>
          <strong>{actor.actorId}</strong>
          <span>{actor.visited.join(" → ")} → </span>
          <button
            disabled={!onLocate && !session}
            onClick={() => void inspect(actor.moduleId)}
          >
            {actor.moduleId} · 决策已选择
          </button>
          <small>{actor.reason}</small>
        </div>
      ))}
      {sourceText?.hash === sourceHash && <pre>{sourceText.text}</pre>}
    </section>
  );
}
export function BehaviorFlow({ plan }: { plan: BehaviorPlan }) {
  return (
    <nav className="behavior-flow" aria-label="优先级组合路径">
      <span>岗位筛选</span>
      {plan.modules
        .filter((m) => m.enabled)
        .slice()
        .sort((a, b) => b.priority - a.priority)
        .map((m) => (
          <a key={m.moduleId} href={`#module-${m.moduleId}`}>
            → {moduleNames[m.kind]}{" "}
            <small>{m.priority} · 命中则选择 / 未命中继续</small>
          </a>
        ))}
      <span>→ 保持 · 无动作意图</span>
    </nav>
  );
}

export function readBehaviorTrace(value: unknown): BehaviorTrace | null {
  if (!value || typeof value !== "object") return null;
  const trace = value as BehaviorTrace;
  return trace.v === 1 &&
    typeof trace.tick === "number" &&
    Array.isArray(trace.actors) &&
    trace.actors.every(
      (a) =>
        typeof a.actorId === "string" &&
        typeof a.moduleId === "string" &&
        Array.isArray(a.visited) &&
        a.visited.every((v) => typeof v === "string") &&
        typeof a.reason === "string",
    )
    ? trace
    : null;
}
