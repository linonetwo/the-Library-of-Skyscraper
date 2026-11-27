import type {Snapshot} from "./types";
export default function ExpeditionSummary({snapshot,playerId}:{snapshot:Snapshot;playerId?:string}){
  const result=snapshot.result;
  if(!result)return null;
  const report=snapshot.scenario?.report;
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
  return <>
      <span className="eyebrow">首场书库远征 · 结算</span>
      <h2>
        {result.winner === playerId
          ? "编目完成 · 远征胜利"
          : "远征失败"}
      </h2>
      <p>{result.reason}</p>
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
                (a) => a.owner === playerId && a.hp > 0,
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
  </>;
}
