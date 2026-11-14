import { useArena } from "./ArenaWorkspace";
import { useState } from "react";
import ReplayPanel from "./ReplayPanel";

export default function JournalPanel() {
  const { session, snapshot, busy, exportReplay } = useArena();
  const [replayOpen, setReplayOpen] = useState(false);

  return (
    <div className="workspace-overlay journal-panel">
      <span className="eyebrow">AN EVIDENCE OF EVERY STEP</span>
      <h2>每一步，都有迹可循。</h2>
      <button disabled={!session || busy} onClick={() => void exportReplay()}>
        导出命令回放
      </button>
      <button disabled={!session} onClick={() => setReplayOpen(true)}>播放赛局回放</button>
      {replayOpen && session && <ReplayPanel session={session} onClose={() => setReplayOpen(false)} />}
      <p>
        下方仅保留最近 100 条事件；完整命令录制可导出，服务器重启前请自行保存。
      </p>
      <p>来自服务器的真实事件记录 · {snapshot?.events.length || 0} 条</p>
      <div className="journal-list">
        {snapshot?.events
          .slice()
          .reverse()
          .map((event) => (
            <div key={event.id}>
              <time>T{String(event.tick).padStart(4, "0")}</time>
              <span>{event.message}</span>
              <small>{event.kind}</small>
            </div>
          )) || <p>启程后，赛局事件将在这里归档。</p>}
      </div>
    </div>
  );
}
