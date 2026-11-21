import { useArena } from "./ArenaWorkspace";
export default function ExpeditionResult() {
  const { snapshot, session, command, setView, setLobby, view, lobby } =
    useArena();
  if (!snapshot?.result || view !== "map" || lobby) return null;
  const report = snapshot.scenario?.report;
  const labels: Record<string, string> = {
    downed: "倒地人数",
    catalogTicks: "编目有效步数",
    materialsDelivered: "建材入库",
    materialsSpent: "建设消费",
    cargoLost: "携货损失",
    survivors: "存活人数",
    actorsLost: "倒地人数",
    catalogActiveTicks: "编目有效步数",
    catalogProgress: "编目进度",
    deliveredMaterials: "建材入库",
    spentMaterials: "建设消费",
    lostCargo: "携货损失",
    survivingActors: "存活人数",
    fallenActors: "倒地人数",
  };
  return (
    <div className="result-card">
      <span className="eyebrow">首场书库远征 · 结算</span>
      <h2>
        {snapshot.result.winner === session?.playerId
          ? "编目完成 · 远征胜利"
          : "远征失败"}
      </h2>
      <p>{snapshot.result.reason}</p>
      <div className="report-grid">
        <div>
          编目进度
          <b>
            {snapshot.scenario?.catalogProgress ?? 0} /{" "}
            {snapshot.scenarioConfig?.catalogGoal ?? 60}
          </b>
        </div>
        <div>
          小队存活
          <b>
            {
              snapshot.actors.filter(
                (a) => a.owner === session?.playerId && a.hp > 0,
              ).length
            }{" "}
            / 3
          </b>
        </div>
        {Object.entries(report ?? {})
          .filter(([key, value]) => typeof value === "number" && key in labels)
          .map(([key, value]) => (
            <div key={key}>
              {labels[key] ?? key}
              <b>{String(value)}</b>
            </div>
          ))}
      </div>
      <p>{snapshot.scenario?.blockedReason}</p>
      <button onClick={() => setView("journal")}>查看关键事件与规则</button>
      {snapshot.mode === "training" ? (
        <button
          className="primary"
          onClick={() => void command({ type: "reset" })}
        >
          相同 seed 重试
        </button>
      ) : (
        <button className="primary" onClick={() => setLobby(true)}>
          返回联机大厅
        </button>
      )}
    </div>
  );
}
