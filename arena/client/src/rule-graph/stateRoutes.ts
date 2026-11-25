import type {
  GraphState,
  GraphTransition,
} from "../../../behavior-modules/graph";
import type { StateLayout } from "./stateLayout";
export function routeStateTransitions(
  states: readonly GraphState[],
  transitions: readonly GraphTransition[],
  layout: StateLayout,
) {
  const routes = new Map<
    string,
    {
      path: string;
      label: string;
      labelX: number;
      labelY: number;
      idY: number;
      anchor: "start" | "middle";
    }
  >();
  if (!layout.pairs.length) return routes;
  let lane = 0;
  for (const edge of transitions) {
    const from = layout.positions.get(edge.from),
      to = layout.positions.get(edge.to);
    if (!from || !to) continue;
    const pair = layout.pairs.find(
      (p) =>
        (edge.from === p.normal.id && edge.to === p.recovery.id) ||
        (edge.from === p.recovery.id && edge.to === p.normal.id),
    );
    if (pair) {
      const entering = edge.from === pair.normal.id;
      const y = from.y + (entering ? 24 : 72);
      const x = from.x + (entering ? layout.nodeWidth : 0);
      const tx = to.x + (entering ? 0 : layout.nodeWidth);
      routes.set(edge.id, {
        anchor: "middle",
        path: `M${x},${y} H${tx}`,
        label: entering ? "进入恢复" : "恢复原状态",
        labelX: (x + tx) / 2,
        labelY: y - 10,
        idY: y + 13,
      });
    } else {
      const x = 24 + lane * 80;
      const offset = lane % 2 === 0 ? 24 : 72;
      const y = from.y + offset,
        ty = to.y + offset;
      lane++;
      routes.set(edge.id, {
        anchor: "start",
        path: `M${from.x},${y} H${x} V${ty} H${to.x}`,
        label: `${states.find((s) => s.id === edge.from)?.name ?? edge.from} → ${states.find((s) => s.id === edge.to)?.name ?? edge.to}`,
        labelX: x + 8,
        labelY: (y + ty) / 2 - 10,
        idY: (y + ty) / 2 + 12,
      });
    }
  }
  return routes;
}
