import ExpeditionSummary from "./ExpeditionSummary";
import TacticalResult from "./TacticalResult";
import "./styles/tactical-result.css";
import { resultEvent } from "./eventReplay";
import { useArena } from "./ArenaWorkspace";
export default function ExpeditionResult() {
  const { snapshot, session, command, setView, setJournalFocus, setLobby, view, lobby } =
    useArena();
  if (!snapshot?.result || view !== "map" || lobby) return null;
  const event = resultEvent(snapshot);
  return (
    <div className={`result-card${snapshot.scenarioId==='seal-contest'?' tactical-result':''}`}>
      {snapshot.scenarioId==='seal-contest'
        ? <TacticalResult snapshot={snapshot} playerId={session?.playerId}/>
        : <ExpeditionSummary snapshot={snapshot} playerId={session?.playerId}/>}
      <button onClick={() => {
        setJournalFocus(event ? { sessionId: snapshot.sessionId, event } : null);
        setView("journal");
      }}>查看关键事件与规则</button>
      {event && <p>{event.kind === "settlement" ? "结算事件" : "最后记录事件"} · T{event.tick} · {event.message}</p>}
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
