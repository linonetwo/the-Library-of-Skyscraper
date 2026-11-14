import { useState } from "react";
import { createPortal } from "react-dom";
import MapCanvas from "./MapCanvas";
import { useDialog } from "./useDialog";
import { useReplay } from "./useReplay";
import type { Session } from "./types";

export default function ReplayPanel({ session, onClose }: { session: Session; onClose: () => void }) {
  const dialog = useDialog(onClose);
  const replay = useReplay(session);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const snapshot = replay.frame?.snapshot ?? null;
  return createPortal(
    <div className="modal-backdrop">
      <section ref={dialog} className="modal replay-panel" role="dialog" aria-modal="true"
        aria-labelledby="replay-title" tabIndex={-1}
        style={{ width: "min(1000px, 94vw)", maxWidth: "1000px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><span className="eyebrow">CHRONICLE · REPLAY</span><h2 id="replay-title">书苑行迹 · 赛局回放</h2></div>
          <button onClick={onClose}>返回实时赛局</button>
        </header>
        {replay.error && <p role="alert">{replay.error}</p>}
        {replay.timeline ? <>
          <div style={{ position: "relative", height: "min(52vh, 540px)", background: "#172b2e", borderRadius: "16px", overflow: "hidden" }}>
            <MapCanvas snapshot={snapshot} selected={selected} selectedRoom={selectedRoom}
              zoom={1} showRoutes
              onSelect={setSelected} onRoom={setSelectedRoom} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "16px", flexWrap: "wrap" }}>
            <button onClick={replay.toggle}>{replay.playing ? "暂停回放" : "播放回放"}</button>
            <label>播放速度 <select aria-label="回放速度" value={replay.speed} onChange={(e) => replay.setSpeed(Number(e.target.value))}>
              {[0.5, 1, 2, 4].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
            </select></label>
            <span>操作 {replay.frame?.operationIndex} / {replay.lastIndex} · T{replay.frame?.tick}</span>
          </div>
          <input style={{ width: "100%", marginTop: "14px" }} type="range" aria-label="回放进度"
            min={0} max={replay.lastIndex} value={replay.index} step={1}
            onChange={(e) => replay.seek(Number(e.target.value))} />
          <p>按录制操作顺序播放 · 重置前后的行迹连续保留 · 实时赛局继续独立运行</p>
          <p>{snapshot?.events.at(-1)?.message || "赛局初始状态"}</p>
        </> : !replay.error && <p>正在重演赛局行迹…</p>}
      </section>
    </div>,
    document.body,
  );
}
