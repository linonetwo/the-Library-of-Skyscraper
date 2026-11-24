import { useArena } from "./ArenaWorkspace";
import { useEffect, useRef, useState } from "react";
import ReplayPanel from "./ReplayPanel";

export default function JournalPanel() {
  const { session, snapshot, busy, exportReplay, journalFocus } = useArena();
  const [replayOpen, setReplayOpen] = useState(false);
  const [replayTarget, setReplayTarget] = useState<import("./eventReplay").EventFocus | null>(null);
  const focused = useRef<HTMLDivElement>(null);
  const focus = journalFocus && journalFocus.sessionId === snapshot?.sessionId && journalFocus.sessionId === session?.sessionId ? journalFocus : null;
  useEffect(() => { setReplayOpen(false); setReplayTarget(null); }, [session?.sessionId]);
  useEffect(() => { focused.current?.scrollIntoView({ block: "center" }); focused.current?.focus(); }, [focus]);

  return (
    <div className="workspace-overlay journal-panel">
      <span className="eyebrow">AN EVIDENCE OF EVERY STEP</span>
      <h2>每一步，都有迹可循。</h2>
      <button disabled={!session || busy} onClick={() => void exportReplay()}>
        导出命令回放
      </button>
      <button disabled={!session} onClick={() => { setReplayTarget(null); setReplayOpen(true); }}>播放赛局回放</button>
      {replayOpen && session && <ReplayPanel session={session} target={replayTarget} onClose={() => setReplayOpen(false)} />}
      <p>
        下方显示最近 100 条事件；赛局每两秒自动归档。导出的回放包含本人的策略记忆与任务，分享时一并提供这些内容。
      </p>
      <p>来自服务器的真实事件记录 · {snapshot?.events.length || 0} 条</p>
      <div className="journal-list">
        {snapshot?.events
          .slice()
          .reverse()
          .map((event) => (
            <div key={event.id} data-event-id={event.id} data-event-tick={event.tick}
              ref={focus?.event.id === event.id ? focused : undefined}
              tabIndex={focus?.event.id === event.id ? -1 : undefined}
              aria-label={focus?.event.id === event.id ? "已定位事件" : undefined}
              style={focus?.event.id === event.id ? { outline: "2px solid #c4a874", background: "#30403b" } : undefined}>
              <time>T{String(event.tick).padStart(4, "0")}</time>
              <span>{event.message}</span>
              <small>{event.kind} · #{event.id}</small>
              <button disabled={!session} onClick={() => {
                setReplayTarget({ sessionId: snapshot!.sessionId, event }); setReplayOpen(true);
              }}>回放此刻</button>
            </div>
          )) || <p>启程后，赛局事件将在这里归档。</p>}
      </div>
    </div>
  );
}
