import { BookMarked, ArrowUpRight } from "lucide-react";
import { useArena } from "./ArenaWorkspace";

export default function RecentExpeditions() {
  const { expeditions, resume, busy } = useArena();
  return <section className="recent-expeditions" aria-label="最近远征">
    <header><BookMarked size={18} /><h3>续写上一章</h3><small>本机远征册</small></header>
    <p>赛局由本地服务器自动归档；此浏览器记住你的入场身份。</p>
    {expeditions.length ? <div className="expedition-list">
      {expeditions.map(entry => <button
        key={`${entry.session.sessionId}/${entry.session.playerId}`}
        className="expedition-card" disabled={busy}
        aria-label={`继续远征 ${entry.session.sessionId}`}
        onClick={() => void resume(entry.session)}>
        <span className="expedition-mark">{entry.mode === "training" ? "训" : "联"}</span>
        <span><strong>{entry.mode === "training" ? "训练远征" : "联机远征"}
          <code>{entry.session.sessionId.slice(0, 8)}</code></strong>
          <small>T{entry.tick} · {entry.phase === "settled" ? "已结算" : "进行中"} · {entry.session.playerId}</small></span>
        <time>{new Date(entry.updatedAt).toLocaleString("zh-CN", {
          month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
        })}</time>
        <ArrowUpRight size={16} />
      </button>)}
    </div> : <div className="expedition-empty">启程后，你的远征将收录在这里。</div>}
  </section>;
}
