import { ChevronRight, Shield, Gem, Package } from "lucide-react";

import { useArena } from "./ArenaWorkspace";

export default function ArenaHeader() {
  const {
    session,
    snapshot,
    connection,
    setLobby,
    player,
    ownActors,
    training,
  } = useArena();

  return (
    <header className="topbar">
      <div className="wordmark">
        <h1>
          通天书苑<span>：竞技场</span>
        </h1>
        <p>
          THE INFINITE ARCHIVE <i /> ARENA
        </p>
      </div>
      <div className="resource-strip">
        <div>
          <Package size={19} />
          <span>
            <small>藏材</small>
            <b>{player?.materials ?? "—"}</b>
          </span>
        </div>
        <div>
          <Gem size={19} />
          <span>
            <small>编目得分</small>
            <b>{player?.score ?? "—"}</b>
          </span>
        </div>
        <div>
          <Shield size={19} />
          <span>
            <small>在编小队</small>
            <b>
              {snapshot
                ? `${ownActors.filter((a) => a.hp > 0).length} / ${ownActors.length}`
                : "—"}
            </b>
          </span>
        </div>
      </div>
      <button className="session-button" onClick={() => setLobby(true)}>
        <span className={`connection-dot ${connection}`} />
        <span>
          {connection === "connected"
            ? training
              ? "本地训练局"
              : "联机赛局"
            : connection === "connecting"
              ? "连接中"
              : connection === "disconnected"
                ? "连接已断开"
                : "尚未入场"}
          <small>{session ? session.sessionId : "选择你的下一场远征"}</small>
        </span>
        <ChevronRight size={16} />
      </button>
    </header>
  );
}
