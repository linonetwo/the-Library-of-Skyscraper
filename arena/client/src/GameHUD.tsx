import TacticalActionBar from "./TacticalActionBar";
import {tacticalObjective} from "./tacticalObjective";
import "./styles/tactical-map-ui.css";
import MobilityCommands from "./MobilityCommands";
import { actorActivity } from "./actorActivity";
import { expeditionObjective } from "./expeditionObjective";
import { reasonName } from "./scenarioLabels";
import { useState } from "react";
import { useArena } from "./ArenaWorkspace";
import { roleNames } from "./types";
import PaperDoll from "./PaperDoll";
import SimulationBar from "./SimulationBar";
import ExpeditionTasks from "./ExpeditionTasks";
export default function GameHUD() {
  const [menu, setMenu] = useState(false),
    [training, setTraining] = useState(false),
    [tasks, setTasks] = useState(true);
  const {
    snapshot,
    mobilityChoice,
    view,
    actor,
    ownActors,
    selectActor,
    player,
    connection,
    setView,
    openAiEditor,
    setLobby,
    setHelp,
    setInspecting,
    setSelectedRoom,
    command,
    ready,
    isOwner,
  } = useArena();
  if (!snapshot) return null;
  const seconds = Math.ceil(
    ((snapshot?.scenario?.remainingTicks ??
      Math.max(
        0,
        (snapshot?.scenarioConfig?.durationTicks ?? 960) -
          (snapshot?.tick ?? 0),
      )) *
      (snapshot?.tickDurationMs ?? 500)) /
      1000,
  );
  const objective = tacticalObjective(snapshot,player?.id) ?? expeditionObjective(snapshot, player ?? undefined);
  const downed = ownActors.filter((a) => a.hp <= 0);
  const cargo = ownActors.reduce((sum, a) => sum + a.cargo, 0);
  const activity = actor ? actorActivity(actor, snapshot) : undefined;
  return (
    <div className="game-hud">
      {view === "map" && <TacticalActionBar />}
      <header className="game-top">
        <div className="hud-objective">
        <button
          className="objective-button"
          onClick={() => objective.roomId && setSelectedRoom(objective.roomId)}
        >
          <strong>{objective.title}</strong>
        </button>
        <details className="hud-objective-details"><summary>目标详情</summary><div>
          <strong>{objective.title}</strong><p>{objective.detail}</p>
          {objective.roomId&&<button onClick={()=>setSelectedRoom(objective.roomId!)}>定位目标房间</button>}
        </div></details>
        </div>
        <b className={seconds < 60 ? "risk-text" : ""}>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </b>
        <span>
          建材 <b>{player?.materials ?? 0}</b> · 携带 {cargo}
        </span>
        {downed.length > 0 && (
          <button
            className="risk-text"
            onClick={() => {
              selectActor(downed[0].id);
              setSelectedRoom(downed[0].roomId);
            }}
          >
            己方倒地 {downed.length} · {roleNames[downed[0].role]}
          </button>
        )}
        {snapshot.mode === "training" &&
          snapshot.paused &&
          snapshot.tick === 0 &&
          !player?.script && (
            <button
              onClick={async () => {
                const assigned = await command({
                  type: "rule",
                  preset: "gather",
                  retreatHp: player?.rule.retreatHp ?? 35,
                  assignTasks: true,
                });
                if (assigned) setTasks(false);
              }}
            >
              推荐分工
            </button>
          )}
        <span className="hud-risk">
          {snapshot?.scenario?.counterattackSpawned
            ? "反扑已至"
            : snapshot?.scenario?.counterattackTick != null
              ? "反扑即将抵达"
              : snapshot?.paused
                ? snapshot.tick === 0
                  ? "准备阶段"
                  : "远征暂停"
                : "远征进行中"}
        </span>
        <span title={connection}>●</span>
        {snapshot?.mode === "training" && (
          <button
            disabled={!ready}
            onClick={() =>
              void command({ type: "pause", paused: !snapshot.paused })
            }
          >
            {snapshot.phase === "settled"
              ? "远征结束"
              : snapshot.paused
                ? "开始远征"
                : "暂停"}
          </button>
        )}
        <button
          className="ai-entry"
          onClick={() => {
            setInspecting(false);
            setSelectedRoom(null);
            void openAiEditor();
            setMenu(false);
            setTraining(false);
          }}
        >
          AI 模块编辑
        </button>
        <button
          className="menu-trigger"
          onClick={() => {
            setInspecting(false);
            setSelectedRoom(null);
            setMenu(!menu);
            setTraining(false);
          }}
        >
          菜单
        </button>
      </header>
      {menu && (
        <nav className="game-menu" aria-label="游戏菜单">
          {(["rules", "journal"] as const).map((view, i) => (
            <button
              key={view}
              onClick={() => {
                setView(view);
                setMenu(false);
              }}
            >
              {["AI 模块编辑", "赛局日志"][i]}
            </button>
          ))}
          <button
            onClick={() => {
              setLobby(true);
              setMenu(false);
            }}
          >
            联机大厅
          </button>
          <a href="/animation-lab">纸娃娃工坊</a>
          <button
            onClick={() => {
              setHelp(true);
              setMenu(false);
            }}
          >
            操作指南
          </button>
          {snapshot.mode === "training" && (
            <button
              onClick={() => {
                setTraining(!training);
                setMenu(false);
              }}
            >
              训练控制
            </button>
          )}
        </nav>
      )}
      {training && (
        <div className="game-training">
          <button onClick={() => setTraining(false)}>收起训练控制</button>
          <SimulationBar />
        </div>
      )}
      {actor && view === "map" && (
        <section className="game-dock" aria-label="选中角色操作">
          <div className="dock-squad">
            {ownActors.map((unit) => (
              <button
                key={unit.id}
                className={
                  (actor.id === unit.id ? "selected" : "") +
                  (unit.hp <= 0 ? " downed" : "")
                }
                aria-label={`选择${roleNames[unit.role]}`}
                onClick={() => selectActor(unit.id)}
              >
                <PaperDoll small {...unit.appearance} />
                <span>{roleNames[unit.role]}</span>
                <small>
                  {actorActivity(unit, snapshot).title}
                </small>
                <progress value={unit.hp} max={unit.maxHp} />
              </button>
            ))}
          </div>
          <div className="dock-summary">
            <strong>
              {roleNames[actor.role]} ·{" "}
              {activity?.title}
            </strong>
            <small>
              生命 {actor.hp}/{actor.maxHp} · 负重 {actor.cargo}/
              {actor.cargoCapacity}
            </small>
            <small>
              {activity?.detail}{actor.travel ? ` · 估计 ${activity?.etaSeconds}秒` : ""}
            </small>
            {actor.task?.blockedReason && (
              <small className="risk-text">
                {reasonName(actor.task.blockedReason)}
              </small>
            )}
          </div>
          <div className="dock-actions">
            <button onClick={() => setTasks(!tasks)}>
              {tasks ? "收起任务" : "安排任务"}
            </button>
            <button
              onClick={() => {
                setInspecting(true);
                setSelectedRoom(null);
              }}
            >
              角色详情
            </button>
            <label>
              撤退阈值{" "}
              <select
                aria-label="撤退阈值"
                value={player?.rule.retreatHp ?? 35}
                disabled={!ready || !isOwner}
                onChange={(e) =>
                  void command({
                    type: "rule",
                    preset: player?.rule.preset ?? "gather",
                    retreatHp: Number(e.target.value),
                  })
                }
              >
                {[0, 20, 35, 50, 70].map((v) => (
                  <option key={v} value={v}>
                    {v}%
                  </option>
                ))}
              </select>
            </label>
          </div>
          {tasks && !mobilityChoice && <ExpeditionTasks />}
          <MobilityCommands />
        </section>
      )}
    </div>
  );
}
