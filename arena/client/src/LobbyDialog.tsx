import {
  BookOpen,
  Compass,
  Network,
  X,
  ArrowUpRight,
  Copy,
} from "lucide-react";

import { useArena } from "./ArenaWorkspace";
import { useDialog } from "./useDialog";
export default function LobbyDialog() {
  const {
    session,
    busy,
    start,
    copySession,
    lobby,
    setLobby,
    joinId,
    setJoinId,
    training,
  } = useArena();
  const dialog = useDialog(() => setLobby(false));
  return (
    <div className="modal-backdrop" onClick={() => setLobby(false)}>
      <section
        ref={dialog}
        tabIndex={-1}
        className="modal lobby-modal"
        role="dialog"
        aria-modal="true"
        aria-label="赛局入口"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="close-button"
          aria-label="关闭赛局入口"
          onClick={() => setLobby(false)}
        >
          <X size={20} />
        </button>
        <BookOpen className="modal-emblem" size={35} />
        <span className="eyebrow">YOUR NEXT CHAPTER</span>
        <h2>新的远征，从这里开始。</h2>
        <p>
          训练局支持暂停与单步推进。联机局由服务器持续推进，同一编号的玩家共享战场。
        </p>
        <div className="lobby-options">
          <button disabled={busy} onClick={() => void start("training")}>
            <Compass size={25} />
            <strong>本地训练</strong>
            <span>独立赛局 · 暂停与单步</span>
            <ArrowUpRight size={16} />
          </button>
          <button disabled={busy} onClick={() => void start("online")}>
            <Network size={25} />
            <strong>创建联机</strong>
            <span>邀请伙伴 · 最多四人共享战场</span>
            <ArrowUpRight size={16} />
          </button>
        </div>
        <label className="field-label" htmlFor="join-id">
          使用赛局编号加入
        </label>
        <form
          className="join-form"
          onSubmit={(e) => {
            e.preventDefault();
            void start("online", true);
          }}
        >
          <input
            id="join-id"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            placeholder="粘贴对方的赛局编号"
            autoComplete="off"
          />
          <button
            className="primary"
            disabled={busy || !joinId.trim()}
            type="submit"
          >
            加入赛局
          </button>
        </form>
        {session && (
          <div className="current-session">
            <span>
              当前赛局 <code>{session.sessionId}</code>
            </span>
            <button onClick={() => void copySession()}>
              <Copy size={14} />
              复制编号
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
