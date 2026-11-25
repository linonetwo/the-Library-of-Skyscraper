import "./styles/mobility.css";
import { useArena } from "./ArenaWorkspace";
import { mobilityCommand, runChoices } from "./mobilityChoices";

export default function MobilityCommands() {
  const { actor, snapshot, ready, isOwner, player, command, mobilityChoice: choice, setMobilityChoice } = useArena();
  if (!actor || !snapshot || (snapshot.simulationVersion ?? 0) < 7 || !snapshot.worldMap?.mobilityEdges?.length) return null;
  const roomName = (id: string) => snapshot.rooms.find((room) => room.id === id)?.name ?? id;
  const routes = runChoices(snapshot, actor.roomId);
  const selected = mobilityCommand(snapshot, actor, choice);
  const edge = choice && choice.kind !== "run" ? snapshot.worldMap.mobilityEdges.find((edge) => edge.edgeId === choice.edgeId) : undefined;
  const reason = !isOwner ? "请选择本人角色" : actor.hp <= 0 ? "倒地角色无法机动"
    : player?.script ? "AI 规则已接管；停用脚本后可手动指挥"
    : actor.travel ? "角色正在行进；到达后可选择下一条路线"
    : choice && choice.kind !== "run" && choice.edgeId && !selected ? "角色尚未到达这条通路的端点房间" : !selected ? "选择动作与路线后确认" : "预览不会下令，确认后由服务器执行";
  return (
    <details className="mobility-commands" open={!!choice}>
      <summary>机动指挥</summary>
      <div className="mobility-kinds" role="group" aria-label="机动动作">
        {([['run', '疾跑'], ['jump', '跃桥'], ['climb', '攀梯']] as const).map(([kind, label]) =>
          <button key={kind} aria-pressed={choice?.kind === kind} onClick={() => setMobilityChoice(
            kind === "run" ? { kind, viaRoomId: "", roomId: "" } : { kind, edgeId: "" },
          )}>{label}</button>)}
      </div>
      {choice?.kind === "run" ? <div className="mobility-fields">
        <label>途经房间<select aria-label="疾跑途经房间" value={choice.viaRoomId} onChange={(event) =>
          setMobilityChoice({ kind: "run", viaRoomId: event.target.value, roomId: "" })}>
          <option value="">选择途经房间</option>
          {[...new Set(routes.map((route) => route.viaRoomId))].map((id) => <option key={id} value={id}>{roomName(id)}</option>)}
        </select></label>
        <label>最终目标<select aria-label="疾跑最终目标" value={choice.roomId} onChange={(event) =>
          setMobilityChoice({ ...choice, roomId: event.target.value })}>
          <option value="">选择最终目标</option>
          {routes.filter((route) => route.viaRoomId === choice.viaRoomId).map((route) =>
            <option key={route.roomId} value={route.roomId}>{roomName(route.roomId)}</option>)}
        </select></label>
        {choice.roomId && <p>{roomName(actor.roomId)} → {roomName(choice.viaRoomId)} → {roomName(choice.roomId)}</p>}
      </div> : choice && <label>专用通路<select aria-label="机动专用通路" value={choice.edgeId}
        onChange={(event) => setMobilityChoice({ kind: choice.kind, edgeId: event.target.value })}>
        <option value="">选择通路（可预览两端）</option>
        {snapshot.worldMap.mobilityEdges.filter((edge) => edge.kind === choice.kind).map((edge) =>
          <option key={edge.edgeId} value={edge.edgeId}>{roomName(edge.fromRoomId)} ↔ {roomName(edge.toRoomId)} · {edge.edgeId}</option>)}
      </select></label>}
      {edge && <p>{edge.edgeId} · {roomName(actor.roomId === edge.toRoomId ? edge.toRoomId : edge.fromRoomId)} → {roomName(actor.roomId === edge.toRoomId ? edge.fromRoomId : edge.toRoomId)}</p>}
      <p role="status">{reason}</p>
      <button className="primary" disabled={!ready || !isOwner || actor.hp <= 0 || !!player?.script || !!actor.travel || !selected}
        onClick={() => { if (selected) void command(selected); }}>确认机动</button>
      {choice && <button onClick={() => setMobilityChoice(null)}>清除路线预览</button>}
    </details>
  );
}
