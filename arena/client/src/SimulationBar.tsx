import { Play, Pause, SkipForward, Radio, RotateCcw } from "lucide-react";

import { useArena } from "./ArenaWorkspace";

export default function SimulationBar() {
  const { snapshot, connection, busy, command, ready, training } = useArena();

  return (
    <div className="simulation-bar">
      <div>
        <Radio size={14} />
        <span>
          {connection === "connected" ? "服务器权威模拟" : "等待服务器连接"}
        </span>
        <span className="divider" />
        <small>
          {snapshot
            ? `种子 ${snapshot.seed} · ${snapshot.paused ? "已暂停" : snapshot.phase === "settled" ? "已结算" : "进行中"}`
            : "无模拟数据"}
        </small>
      </div>
      <div>
        {training && (
          <>
            <button
              disabled={!ready}
              onClick={() =>
                void command({
                  type: "pause",
                  paused: !snapshot?.paused,
                })
              }
            >
              {snapshot?.paused ? <Play size={14} /> : <Pause size={14} />}{" "}
              {snapshot?.paused ? "继续" : "暂停"}
            </button>
            <button
              disabled={!ready || !snapshot?.paused}
              onClick={() => void command({ type: "step", ticks: 1 })}
            >
              <SkipForward size={14} /> 单步
            </button>
            <button
              disabled={busy || !snapshot}
              onClick={() => void command({ type: "reset" })}
              title="重置训练局"
              aria-label="重置训练局"
            >
              <RotateCcw size={14} />
            </button>
          </>
        )}
        <span className="live-label">
          {connection === "connected" ? "LIVE" : "OFFLINE"}
        </span>
      </div>
    </div>
  );
}
