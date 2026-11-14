import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Compass,
  Swords,
  ScrollText,
  Settings2,
  Network,
  Plus,
  Minus,
  Play,
  Pause,
  SkipForward,
  X,
  ChevronRight,
  Feather,
  Shield,
  Hammer,
  ArrowUpRight,
  Radio,
  Layers3,
  RotateCcw,
  Check,
  Copy,
  Flag,
  Gem,
  Package,
  CircleHelp,
  Sparkles,
} from "lucide-react";
import MapCanvas from "./MapCanvas";
import PaperDoll from "./PaperDoll";
import { outfitNames, roleNames } from "./types";
import type { Command, Outfit, Session, Snapshot } from "./types";

const presetNames = {
  gather: "资源优先",
  defend: "守卫书库",
  explore: "深入探索",
};
const stateNames: Record<string, string> = {
  idle: "等待指令",
  moving: "探索行进",
  gathering: "采集藏材",
  fighting: "迎战威胁",
  retreating: "撤退休整",
  defending: "守卫书库",
  guarding: "守卫书库",
  scouting: "巡查书库",
};
const stateName = (value?: string) =>
  stateNames[value || "idle"] || value || "等待指令";
type View = "map" | "rules" | "journal";
function readSession(): Session | null {
  try {
    return JSON.parse(sessionStorage.getItem("arena-session") || "null");
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(readSession);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connection, setConnection] = useState<
    "idle" | "connecting" | "connected" | "disconnected"
  >("idle");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [outfits, setOutfits] = useState<Record<string, Outfit>>({});
  const [hairs, setHairs] = useState<Record<string, "ivory" | "midnight">>({});
  const [weapons, setWeapons] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState(1);
  const [showRoutes, setShowRoutes] = useState(true);
  const [view, setView] = useState<View>("map");
  const [lobby, setLobby] = useState(false);
  const [help, setHelp] = useState(false);
  const [joinId, setJoinId] = useState("");
  const [preset, setPreset] = useState<"gather" | "defend" | "explore">(
    "gather",
  );
  const [threshold, setThreshold] = useState(35);
  const [notice, setNotice] = useState("");
  const latestTick = useRef(-1);
  const dialog = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!lobby && !help) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = dialog.current;
    panel?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLobby(false);
        setHelp(false);
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const targets = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ),
      );
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [lobby, help]);

  const acceptSnapshot = useCallback((next: Snapshot) => {
    if (next.tick < latestTick.current) return;
    latestTick.current = next.tick;
    setSnapshot(next);
  }, []);
  useEffect(() => {
    if (!session) return;
    let disposed = false;
    let socket: WebSocket | undefined;
    let reconnect: ReturnType<typeof setTimeout>;
    let attempts = 0;
    latestTick.current = -1;
    const connect = async () => {
      setConnection("connecting");
      try {
        const response = await fetch(
          `/api/sessions/${session.sessionId}/state`,
          { headers: { Authorization: `Bearer ${session.token}` } },
        );
        if (!response.ok)
          throw new Error(
            `赛局读取失败 (${response.status})，请重新创建或加入赛局。`,
          );
        const next = (await response.json()) as Snapshot;
        if (disposed) return;
        acceptSnapshot(next);
        setSelected((current) =>
          next.actors.some((a) => a.id === current)
            ? current
            : next.actors.find((a) => a.owner === session.playerId)?.id || null,
        );
        const player = next.players.find((p) => p.id === session.playerId);
        if (player) {
          setPreset(player.rule.preset);
          setThreshold(player.rule.retreatHp);
        }
        socket = new WebSocket(
          `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/${session.sessionId}?token=${encodeURIComponent(session.token)}`,
        );
        socket.onopen = () => {
          attempts = 0;
          setConnection("connected");
          setError("");
        };
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.sessionId && Array.isArray(data.actors))
              acceptSnapshot(data);
          } catch {
            setError("收到无效赛局数据，正在等待下一个快照。");
          }
        };
        socket.onerror = () => socket?.close();
        socket.onclose = () => {
          if (disposed) return;
          setConnection("disconnected");
          reconnect = setTimeout(
            connect,
            Math.min(1000 * 2 ** attempts++, 10000),
          );
        };
      } catch (cause) {
        if (disposed) return;
        setConnection("disconnected");
        setError(
          cause instanceof Error ? cause.message : "无法连接赛局服务器。",
        );
        reconnect = setTimeout(
          connect,
          Math.min(1000 * 2 ** attempts++, 10000),
        );
      }
    };
    void connect();
    return () => {
      disposed = true;
      clearTimeout(reconnect);
      socket?.close();
    };
  }, [session, acceptSnapshot]);

  const start = async (mode: "training" | "online", join = false) => {
    setBusy(true);
    setError("");
    try {
      if (join && !joinId.trim()) throw new Error("请输入对方分享的赛局编号。");
      const response = await fetch(
        join
          ? `/api/sessions/${encodeURIComponent(joinId.trim())}/join`
          : "/api/sessions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(join ? {} : { mode, seed: 42 }),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `创建赛局失败 (${response.status})`);
      }
      const next = (await response.json()) as Session;
      sessionStorage.setItem("arena-session", JSON.stringify(next));
      setSnapshot(null);
      setSession(next);
      setLobby(false);
      setSelected(null);
      setSelectedRoom(null);
      setView("map");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "请求失败，请确认本地服务器已启动。",
      );
    } finally {
      setBusy(false);
    }
  };
  const command = async (value: Command) => {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/sessions/${session.sessionId}/commands`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify(value),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || `指令未执行 (${response.status})`);
      if (value.type === "reset") latestTick.current = -1;
      acceptSnapshot(data);
      if (value.type === "rule") setNotice("行动规则已发布，下一模拟步生效。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "指令发送失败。");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  const player = snapshot?.players.find((p) => p.id === session?.playerId);
  const actor = snapshot?.actors.find((a) => a.id === selected);
  const room = snapshot?.rooms.find((r) => r.id === selectedRoom);
  const ownActors =
    snapshot?.actors.filter((a) => a.owner === session?.playerId) || [];
  const outfit = actor
    ? outfits[actor.id] || (actor.role === "guard" ? "warden" : "scholar")
    : "scholar";
  const ready =
    !!snapshot &&
    connection === "connected" &&
    !busy &&
    snapshot.phase === "running";
  const training = snapshot?.mode === "training";
  const isOwner = actor?.owner === session?.playerId;
  const selectActor = (id: string) => {
    setSelected(id);
    setSelectedRoom(null);
  };
  const copySession = async () => {
    try {
      await navigator.clipboard.writeText(session!.sessionId);
      setNotice("赛局编号已复制。");
    } catch {
      setNotice(`赛局编号：${session!.sessionId}`);
    }
  };

  const ruleEditor = (
    <div className="rule-editor">
      <span className="eyebrow">AUTONOMOUS DOCTRINE</span>
      <h2>把意图交给小队。</h2>
      <p>
        角色依照已发布的行动规则自主探索、采集与守卫。调整策略，观察每一步的真实结果。
      </p>
      <label className="field-label">行动预设</label>
      <div className="presets">
        {(["gather", "defend", "explore"] as const).map((item, i) => (
          <button
            key={item}
            className={preset === item ? "chosen" : ""}
            onClick={() => setPreset(item)}
          >
            <span>0{i + 1}</span>
            <strong>{presetNames[item]}</strong>
            <small>
              {item === "gather"
                ? "优先收集藏材，发展据点"
                : item === "defend"
                  ? "在据点附近防守与恢复"
                  : "前往未知房间，接触威胁"}
            </small>
            {preset === item && <Check size={16} />}
          </button>
        ))}
      </div>
      <label className="field-label" htmlFor="retreat">
        生命值撤退阈值 <b>{threshold}%</b>
      </label>
      <input
        id="retreat"
        type="range"
        min="0"
        max="100"
        value={threshold}
        onChange={(e) => setThreshold(Number(e.target.value))}
      />
      <div className="range-labels">
        <span>坚持作战</span>
        <span>优先生存</span>
      </div>
      <div className="rule-summary">
        <ScrollText size={17} />
        <span>
          当前规则：
          {player
            ? `${presetNames[player.rule.preset]} · 低于 ${player.rule.retreatHp}% 生命值撤退`
            : "尚未创建赛局"}
        </span>
      </div>
      <button
        className="primary wide"
        disabled={!ready}
        onClick={() =>
          void command({ type: "rule", preset, retreatHp: threshold })
        }
      >
        确认并发布规则 <ArrowUpRight size={16} />
      </button>
    </div>
  );

  return (
    <div className="app-shell">
      <aside className="rail" inert={lobby || help}>
        <button
          className="brand-icon"
          aria-label="打开赛局入口"
          onClick={() => setLobby(true)}
        >
          <BookOpen size={27} />
        </button>
        <div className="rail-mark">
          书<br />苑
        </div>
        <nav aria-label="主导航">
          <button
            className={view === "map" ? "active" : ""}
            onClick={() => setView("map")}
            title="战场总览"
            aria-label="战场总览"
          >
            <Compass />
            <span>战场</span>
          </button>
          <button
            className={view === "rules" ? "active" : ""}
            onClick={() => setView("rules")}
            title="行动规则"
            aria-label="行动规则"
          >
            <Settings2 />
            <span>规则</span>
          </button>
          <button
            className={view === "journal" ? "active" : ""}
            onClick={() => setView("journal")}
            title="赛局日志"
            aria-label="赛局日志"
          >
            <ScrollText />
            <span>日志</span>
          </button>
          <button
            onClick={() => setLobby(true)}
            title="联机大厅"
            aria-label="联机大厅"
          >
            <Network />
            <span>联机</span>
          </button>
        </nav>
        <button
          className="help-button"
          aria-label="操作指南"
          onClick={() => setHelp(true)}
        >
          <CircleHelp size={21} />
        </button>
        <span className="rail-version">α 0.1</span>
      </aside>

      <div className="main-shell" inert={lobby || help}>
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
              <small>
                {session ? session.sessionId : "选择你的下一场远征"}
              </small>
            </span>
            <ChevronRight size={16} />
          </button>
        </header>

        <main className="workspace">
          <section className="battle-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">THE FIRST EXPEDITION</span>
                <h2>
                  {view === "rules"
                    ? "行动规则工作台"
                    : view === "journal"
                      ? "书苑行记"
                      : "无尽书库 · 初始层"}
                </h2>
              </div>
              <div className="phase-tag">
                <span />
                {snapshot?.phase === "settled"
                  ? "远征已结束"
                  : snapshot
                    ? "探索阶段"
                    : "等待启程"}
                <small>
                  {snapshot
                    ? `TICK ${String(snapshot.tick).padStart(4, "0")}`
                    : "SECTOR 01"}
                </small>
              </div>
            </div>
            <div className="map-shell">
              <div className="map-art" />
              <div className="map-shade" />
              <div className="map-topline">
                <span>
                  <Compass size={14} /> 第一书库 /
                  {snapshot ? (
                    <select
                      className="room-select"
                      aria-label="定位地图房间"
                      value={selectedRoom || ""}
                      onChange={(event) => setSelectedRoom(event.target.value || null)}
                    >
                      <option value="">选择房间</option>
                      {snapshot.rooms.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  ) : "六边形房间网络"}
                </span>
                <button
                  className={showRoutes ? "enabled" : ""}
                  onClick={() => setShowRoutes(!showRoutes)}
                  aria-pressed={showRoutes}
                >
                  <Layers3 size={14} /> 资源线
                </button>
              </div>
              <MapCanvas
                snapshot={snapshot}
                selected={selected}
                selectedRoom={selectedRoom}
                outfits={outfits}
                hairs={hairs}
                weapons={weapons}
                zoom={zoom}
                showRoutes={showRoutes}
                onSelect={selectActor}
                onRoom={setSelectedRoom}
              />
              <div className="map-compass">
                <span>N</span>
                <Compass size={46} strokeWidth={0.8} />
              </div>
              {!snapshot && (
                <div className="entry-card">
                  <span className="eyebrow">A WORLD BETWEEN THE PAGES</span>
                  <h2>
                    万卷之中，
                    <br />
                    启程一场远征。
                  </h2>
                  <p>
                    编组你的巡书小队，探索层叠书库。
                    <br />
                    让规则引领行动，让知识成为力量。
                  </p>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => void start("training")}
                  >
                    {busy ? "正在准备书库…" : "开启训练远征"}
                    <ArrowUpRight size={17} />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setLobby(true)}
                  >
                    或加入联机赛局 <ChevronRight size={13} />
                  </button>
                </div>
              )}
              {snapshot?.result && (
                <div className="result-card">
                  <Flag size={26} />
                  <span className="eyebrow">EXPEDITION COMPLETE</span>
                  <h2>
                    {snapshot.result.winner === session?.playerId
                      ? "书苑铭记你的名字"
                      : "本次远征已结束"}
                  </h2>
                  <p>{snapshot.result.reason}</p>
                  <b>编目得分 {player?.score}</b>
                  <button className="primary" onClick={() => setLobby(true)}>
                    开启下一场远征
                  </button>
                </div>
              )}
              <div className="map-bottomline">
                <span>
                  <i className="legend-dot friendly" /> 我方小队
                  <i className="legend-dot danger" /> PVE 威胁
                  <i className="legend-dot objective" /> 编目目标
                </span>
                <div className="zoom-controls">
                  <button
                    aria-label="缩小地图"
                    onClick={() => setZoom(Math.max(0.6, zoom - 0.1))}
                  >
                    <Minus size={15} />
                  </button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button
                    aria-label="放大地图"
                    onClick={() => setZoom(Math.min(1.8, zoom + 0.1))}
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
              {room && view === "map" && (
                <div className="room-popup">
                  <button
                    className="close-button"
                    aria-label="关闭房间详情"
                    onClick={() => setSelectedRoom(null)}
                  >
                    <X size={14} />
                  </button>
                  <small>房间档案 / {room.id}</small>
                  <h3>{room.name}</h3>
                  <p>
                    藏材 {room.resources} · 威胁生命 {room.enemyHp}
                  </p>
                  <div className="room-actions">
                    <button
                      disabled={!ready || !actor || !isOwner}
                      onClick={() =>
                        void command({
                          type: "move",
                          actorId: actor!.id,
                          roomId: room.id,
                        })
                      }
                    >
                      派遣选中角色
                    </button>
                    <button
                      disabled={!ready}
                      onClick={() =>
                        void command({
                          type: "build",
                          roomId: room.id,
                          kind: "tower",
                        })
                      }
                    >
                      <Hammer size={13} />
                      建造哨塔
                    </button>
                    <button
                      disabled={!ready}
                      onClick={() =>
                        void command({
                          type: "build",
                          roomId: room.id,
                          kind: "catalog",
                        })
                      }
                    >
                      建造编目台
                    </button>
                  </div>
                </div>
              )}
              {view === "rules" && (
                <div className="workspace-overlay">{ruleEditor}</div>
              )}
              {view === "journal" && (
                <div className="workspace-overlay journal-panel">
                  <span className="eyebrow">AN EVIDENCE OF EVERY STEP</span>
                  <h2>每一步，都有迹可循。</h2>
                  <p>
                    来自服务器的真实事件记录 · {snapshot?.events.length || 0} 条
                  </p>
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
              )}
            </div>
            <div className="simulation-bar">
              <div>
                <Radio size={14} />
                <span>
                  {connection === "connected"
                    ? "服务器权威模拟"
                    : "等待服务器连接"}
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
                      {snapshot?.paused ? (
                        <Play size={14} />
                      ) : (
                        <Pause size={14} />
                      )}{" "}
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

            <section className="squad-section">
              <div className="panel-title">
                <h3>
                  远征小队 <small>EXPEDITION PARTY</small>
                </h3>
                <span>
                  {ownActors.length
                    ? `${ownActors.length} 位巡书者`
                    : "等待编队"}
                </span>
              </div>
              <div className="squad-cards">
                {ownActors.length ? (
                  ownActors.map((unit, i) => (
                    <button
                      key={unit.id}
                      className={`squad-card ${unit.id === selected ? "selected" : ""}`}
                      onClick={() => selectActor(unit.id)}
                    >
                      <span className="card-number">0{i + 1}</span>
                      <PaperDoll
                        small
                        outfit={
                          outfits[unit.id] ||
                          (unit.role === "guard" ? "warden" : "scholar")
                        }
                        hair={hairs[unit.id]}
                        weapon={weapons[unit.id] !== false}
                      />
                      <div>
                        <small>{unit.role.toUpperCase()}</small>
                        <strong>{roleNames[unit.role]}</strong>
                        <span>{stateName(unit.state)}</span>
                        <div className="health-track">
                          <i
                            style={{
                              width: `${(unit.hp / unit.maxHp) * 100}%`,
                            }}
                          />
                        </div>
                        <em>
                          {unit.hp} / {unit.maxHp}
                        </em>
                      </div>
                      {unit.id === selected && (
                        <Check className="card-check" size={13} />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="squad-empty">
                    <Feather size={21} />
                    <span>
                      小队尚未抵达。开启训练远征后，巡书使、采撷师与守卷人将加入你的队伍。
                    </span>
                  </div>
                )}
              </div>
            </section>
          </section>

          <aside className="inspector">
            <div className="inspector-top">
              <span className="eyebrow">CHARACTER DOSSIER</span>
              <span className="serial">
                NO.{" "}
                {actor
                  ? String(
                      ownActors.findIndex((a) => a.id === actor.id) + 1,
                    ).padStart(3, "0")
                  : "—"}
              </span>
            </div>
            <div className="character-heading">
              <h2>{actor ? roleNames[actor.role] : "待命的巡书者"}</h2>
              <span>{actor ? actor.role.toUpperCase() : "THE ARCHIVIST"}</span>
            </div>
            <div className="portrait-frame">
              <div className="portrait-rings" />
              <PaperDoll
                outfit={outfit}
                hair={actor ? hairs[actor.id] : "ivory"}
                weapon={actor ? weapons[actor.id] !== false : true}
              />
              <span className="portrait-caption">
                PAPER DOLL / 三头身纸娃娃
              </span>
              <div className="portrait-seal">
                <Feather size={19} />
              </div>
            </div>
            <div className="character-stats">
              <div>
                <span>生命</span>
                <b>{actor ? `${actor.hp} / ${actor.maxHp}` : "—"}</b>
              </div>
              <div>
                <span>当前位置</span>
                <b>
                  {snapshot?.rooms.find((r) => r.id === actor?.roomId)?.name ||
                    "尚未入场"}
                </b>
              </div>
              <div>
                <span>行动状态</span>
                <b className="state-text">{stateName(actor?.state)}</b>
              </div>
            </div>
            <div className="wardrobe">
              <div className="panel-title">
                <h3>纸娃娃装束</h3>
                <small>外观 · 本机保存于当前页面</small>
              </div>
              <div className="outfit-options">
                {(["scholar", "warden"] as Outfit[]).map((item) => (
                  <button
                    key={item}
                    disabled={!actor}
                    className={item === outfit ? "selected" : ""}
                    onClick={() =>
                      actor && setOutfits({ ...outfits, [actor.id]: item })
                    }
                  >
                    {item === "scholar" ? (
                      <Sparkles size={16} />
                    ) : (
                      <Shield size={16} />
                    )}
                    <span>{outfitNames[item]}</span>
                    {item === outfit && <Check size={12} />}
                  </button>
                ))}
              </div>
              <div className="appearance-options">
                <span>发色</span>
                <button
                  disabled={!actor}
                  aria-label="月白发色"
                  className={`hair-swatch ivory ${!actor || !hairs[actor.id] || hairs[actor.id] === "ivory" ? "selected" : ""}`}
                  onClick={() =>
                    actor && setHairs({ ...hairs, [actor.id]: "ivory" })
                  }
                />
                <button
                  disabled={!actor}
                  aria-label="墨蓝发色"
                  className={`hair-swatch midnight ${actor && hairs[actor.id] === "midnight" ? "selected" : ""}`}
                  onClick={() =>
                    actor && setHairs({ ...hairs, [actor.id]: "midnight" })
                  }
                />
                <label>
                  <input
                    type="checkbox"
                    disabled={!actor}
                    checked={actor ? weapons[actor.id] !== false : true}
                    onChange={(e) =>
                      actor &&
                      setWeapons({ ...weapons, [actor.id]: e.target.checked })
                    }
                  />{" "}
                  携带法杖
                </label>
              </div>
            </div>
            <div className="quick-actions">
              <button
                disabled={!ready || !isOwner}
                onClick={() =>
                  void command({ type: "gather", actorId: actor!.id })
                }
              >
                <Package size={15} />
                采集
              </button>
              <button
                disabled={!ready || !isOwner}
                onClick={() =>
                  void command({ type: "attack", actorId: actor!.id })
                }
              >
                <Swords size={15} />
                攻击
              </button>
              <button
                disabled={!ready || !isOwner}
                onClick={() =>
                  void command({ type: "capture", actorId: actor!.id })
                }
              >
                <Flag size={15} />
                编目
              </button>
            </div>
            <div className="doctrine-card">
              <div>
                <ScrollText size={16} />
                <h3>当前行动规则</h3>
                <button
                  aria-label="编辑行动规则"
                  onClick={() => setView("rules")}
                >
                  <ArrowUpRight size={15} />
                </button>
              </div>
              <strong>
                {player ? presetNames[player.rule.preset] : "尚未发布"}
              </strong>
              <p>
                {player
                  ? `生命低于 ${player.rule.retreatHp}% 时自动撤退。`
                  : "在训练局中试验属于你的小队策略。"}
              </p>
              <span>规则驱动，而非繁复微操</span>
            </div>
          </aside>
        </main>
        <footer className="event-strip">
          <span className="event-title">
            <ScrollText size={14} />
            书苑纪事
          </span>
          {snapshot?.events.length ? (
            snapshot.events
              .slice(-2)
              .reverse()
              .map((event) => (
                <div key={event.id}>
                  <time>T{String(event.tick).padStart(4, "0")}</time>
                  <span>{event.message}</span>
                </div>
              ))
          ) : (
            <p>此刻的书页，正等待你的第一笔。</p>
          )}
          <button aria-label="查看完整日志" onClick={() => setView("journal")}>
            <ChevronRight size={16} />
          </button>
        </footer>
      </div>

      {error && (
        <div className="toast error" role="alert">
          <span>{error}</span>
          <button aria-label="关闭错误消息" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast notice" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {lobby && (
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
              训练局允许暂停与单步验证。联机局由服务器持续推进，同一编号的玩家共享战场。
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
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            ref={dialog}
            tabIndex={-1}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="操作指南"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close-button"
              aria-label="关闭操作指南"
              onClick={() => setHelp(false)}
            >
              <X size={20} />
            </button>
            <span className="eyebrow">FIELD NOTES</span>
            <h2>巡书者的第一课</h2>
            <ol className="help-list">
              <li>开启训练远征，或创建联机赛局并分享编号。</li>
              <li>点击小队卡片或地图角色，查看生命、位置与装束。</li>
              <li>点击地图房间，派遣选中角色或消耗藏材建造建筑。</li>
              <li>在“规则”页设置行动预设与撤退阈值，确认后发布。</li>
              <li>训练局可暂停与单步。赛局日志记录每次服务端决策。</li>
            </ol>
            <p>
              装束只影响外观，不影响能力；此版本外观选择不跨页面持久化。断线时禁用指令并自动重连。
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
