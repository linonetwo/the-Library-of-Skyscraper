import {
  Compass,
  Plus,
  Minus,
  ChevronRight,
  ArrowUpRight,
  Layers3,
  Flag,
} from "lucide-react";
import MapCanvas from "./MapCanvas";

import { useArena } from "./ArenaWorkspace";
import SquadPanel from "./SquadPanel";
import SimulationBar from "./SimulationBar";
import RoomPopup from "./RoomPopup";
import JournalPanel from "./JournalPanel";
import RuleEditor from "./RuleEditor";
export default function Battlefield() {
  const {
    session,
    snapshot,
    busy,
    start,
    resume,
    expeditions,
    selected,
    selectedRoom,
    setSelectedRoom,
    zoom,
    setZoom,
    showRoutes,
    setShowRoutes,
    view,
    setLobby,
    player,
    room,
    selectActor,
  } = useArena();

  return (
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
                onChange={(event) =>
                  setSelectedRoom(event.target.value || null)
                }
              >
                <option value="">选择房间</option>
                {snapshot.rooms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            ) : (
              "六边形房间网络"
            )}
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
            <button className="text-button" onClick={() => setLobby(true)}>
              或加入联机赛局 <ChevronRight size={13} />
            </button>
            {expeditions[0] && <button className="text-button" disabled={busy}
              onClick={() => void resume(expeditions[0].session)}>
              继续上次远征 <ChevronRight size={13} />
            </button>}
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
        {room && view === "map" && <RoomPopup room={room} />}
        {view === "rules" && (
          <div className="workspace-overlay">
            <RuleEditor />
          </div>
        )}
        {view === "journal" && <JournalPanel />}
      </div>
      <SimulationBar />

      <SquadPanel />
    </section>
  );
}
