import type { RuleNode } from "../../../behavior-modules/graph";
import { useArena } from "../ArenaWorkspace";
import { GraphRoomSelect } from "./GraphRoomSelect";
type MobilityNode = Extract<RuleNode, { type: "mobility" }>;
export function MobilityNodeFields({ node, onChange }: {
  node: MobilityNode; onChange: (node: MobilityNode) => void;
}) {
  const { snapshot } = useArena();
  const action = node.action;
  const edges = snapshot?.worldMap?.mobilityEdges?.filter(edge => edge.kind === action.type) ?? [];
  return <fieldset>
    <legend>机动动作 · 真实到达后交接作业</legend>
    <label>动作方式<select aria-label="规则图机动方式" value={action.type} onChange={e => {
      const type = e.target.value as "run" | "jump" | "climb";
      onChange({ ...node, action: type === "run" ? { type, viaRoomId: "", roomId: "" } : { type, edgeId: "" } });
    }}><option value="run">疾跑</option><option value="jump">跃桥</option><option value="climb">攀梯</option></select></label>
    {action.type === "run" ? <>
      <GraphRoomSelect label="规则图疾跑途经房间" value={action.viaRoomId} onChange={viaRoomId => onChange({ ...node, action: { ...action, viaRoomId } })} />
      <GraphRoomSelect label="规则图疾跑最终目标" value={action.roomId} onChange={roomId => onChange({ ...node, action: { ...action, roomId } })} />
    </> : <label>机动专用通路<select aria-label="规则图机动专用通路" value={action.edgeId} onChange={e => onChange({ ...node, action: { ...action, edgeId: e.target.value } })}>
      <option value="">选择专用通路</option>
      {action.edgeId && !edges.some(edge => edge.edgeId === action.edgeId) && <option value={action.edgeId}>{action.edgeId} · 当前地图不可用</option>}
      {edges.map(edge => <option key={edge.edgeId} value={edge.edgeId}>{edge.fromRoomId} ↔ {edge.toRoomId} · {edge.edgeId}</option>)}
    </select></label>}
    <label>意图优先级<input aria-label="规则图机动优先级" type="number" value={node.priority} onChange={e => onChange({ ...node, priority: Number(e.target.value) })} /></label>
    <p>在途保持原路线；当前房间无法使用该通路时沿回退分支。</p>
  </fieldset>;
}
