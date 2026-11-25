import { layoutDecisionNodes } from "./treeLayout";
import type { GraphTrace, RuleGraph } from "../../../behavior-modules/graph";
import { nodeEdges, nodeNames, type GraphSelection } from "./graphObjects";
export function GraphCanvas({
  graph,
  trace,
  mode,
  selected,
  onSelect,
  rootId,
}: {
  graph: RuleGraph;
  trace?: GraphTrace | null;
  mode: "states" | "tree";
  selected: GraphSelection | null;
  onSelect: (value: GraphSelection) => void;
  rootId?: string;
}) {
  const visited = new Set(
    trace?.actors.flatMap((a) => a.visited.map((n) => n.nodeId)),
  );
  const selectedPath = new Set(
    trace?.actors.flatMap((a) => [a.selectedNodeId, a.endStateId]),
  );
  const visible = new Set<string>();
  const visit = (id: string) => {
    if (visible.has(id)) return;
    visible.add(id);
    const node = graph.nodes.find((n) => n.id === id);
    if (node) nodeEdges(node).forEach((edge) => visit(edge.target));
  };
  if (rootId) visit(rootId);
  const nodes = rootId
    ? graph.nodes.filter((n) => visible.has(n.id))
    : graph.nodes;
  const items =
    mode === "states"
      ? graph.states.map((s) => ({
          id: s.id,
          label: s.name,
          detail: `持续树 ${s.treeId}`,
        }))
      : nodes.map((n) => ({
          id: n.id,
          label: nodeNames[n.type],
          detail: n.id,
        }));
  const edges =
    mode === "states"
      ? graph.transitions.map((t) => ({
          id: t.id,
          from: t.from,
          to: t.to,
          label: `${graph.states.find((s) => s.id === t.from)?.name ?? t.from} → ${graph.states.find((s) => s.id === t.to)?.name ?? t.to}`,
          detail: `${t.id} · 优先级 ${t.priority}`,
          portIndex: 0,
          portCount: 1,
        }))
      : nodes.flatMap((n) =>
          nodeEdges(n).map((edge, i) => ({
            id: `${n.id}-${i}`,
            from: n.id,
            to: edge.target,
            label: edge.label,
            detail: `${n.id} · ${edge.label} → ${edge.target}`,
            portIndex: i,
            portCount: nodeEdges(n).length,
          })),
        );
  const position =
    mode === "tree"
      ? layoutDecisionNodes(items, edges)
      : new Map(
          items.map((item, i) => [
            item.id,
            { x: 30 + (i % 3) * 230, y: 60 + Math.floor(i / 3) * 150 },
          ]),
        );
  return (
    <div
      className="graph-canvas"
      aria-label={mode === "states" ? "状态图画布" : "决策树画布"}
    >
      <svg
        role="group"
        aria-label={mode === "states" ? "跨步状态转移" : "单步决策连接"}
        width={Math.max(740, ...[...position.values()].map((p) => p.x + 210))}
        height={Math.max(250, ...[...position.values()].map((p) => p.y + 140))}
      >
        <defs>
          <marker
            id="rule-edge-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 Z" />
          </marker>
        </defs>
        {edges.map((edge) => {
          const start = position.get(edge.from);
          const end = position.get(edge.to);
          if (!start) return null;
          const paired =
            mode === "states" &&
            end &&
            start.y === end.y &&
            edges.some(
              (other) => other.from === edge.to && other.to === edge.from,
            );
          const top = !!end && start.x < end.x;
          const x = paired ? start.x + 85 : start.x + 170;
          const y = paired
            ? start.y + (top ? 0 : 76)
            : start.y +
              (mode === "tree"
                ? (76 * (edge.portIndex + 1)) / (edge.portCount + 1)
                : 38);
          const tx = end ? end.x + (paired ? 85 : 0) : x + 35;
          const ty = end
            ? paired
              ? end.y + (top ? 0 : 76)
              : end.y + 38
            : y + 34;
          const bend = y + (top ? -45 : 45);
          const path = paired
            ? `M${x},${y} C${x},${bend} ${tx},${bend} ${tx},${ty}`
            : `M${x},${y} C${x + 60},${y} ${tx - 50},${ty} ${tx},${ty}`;
          return (
            <g
              key={edge.id}
              role="button"
              tabIndex={0}
              aria-label={`连接 ${edge.from} ${edge.label} ${edge.to || "未连接"}`}
              onClick={() =>
                onSelect({
                  kind: mode === "states" ? "transitions" : "nodes",
                  id: mode === "states" ? edge.id : edge.from,
                })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect({
                    kind: mode === "states" ? "transitions" : "nodes",
                    id: mode === "states" ? edge.id : edge.from,
                  });
                }
              }}
              aria-pressed={
                mode === "states" &&
                selected?.kind === "transitions" &&
                selected.id === edge.id
              }
              data-edge-id={edge.id}
              data-from={edge.from}
              data-to={edge.to}
              data-port={edge.label}
              className={!end ? "graph-edge dangling" : "graph-edge"}
            >
              <path className="graph-edge-hit" d={path} />
              <path d={path} markerEnd="url(#rule-edge-arrow)" />
              <text
                textAnchor={mode === "tree" ? "start" : "middle"}
                x={mode === "tree" ? x + 12 : (x + tx) / 2}
                y={
                  mode === "tree"
                    ? y - 7
                    : paired
                      ? bend + (top ? 5 : 2)
                      : (y + ty) / 2 - 7
                }
              >
                {edge.label}
                {!end ? " · 引用缺失" : ""}
              </text>
              <title>{edge.detail}</title>
            </g>
          );
        })}
        {items.map((item) => {
          const p = position.get(item.id)!;
          return (
            <g
              key={item.id}
              data-node-id={item.id}
              role="button"
              tabIndex={0}
              aria-label={`${mode === "states" ? "状态" : "节点"} ${item.id}`}
              aria-pressed={selected?.id === item.id}
              data-visited={visited.has(item.id)}
              data-selected-path={selectedPath.has(item.id)}
              className="graph-node"
              transform={`translate(${p.x},${p.y})`}
              onClick={() =>
                onSelect({
                  kind: mode === "states" ? "states" : "nodes",
                  id: item.id,
                })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect({
                    kind: mode === "states" ? "states" : "nodes",
                    id: item.id,
                  });
                }
              }}
            >
              <rect width="170" height="76" rx="8" />
              <text x="12" y="25">
                {item.label}
              </text>
              <text x="12" y="48" className="graph-node-detail">
                {item.detail.length > 23
                  ? `${item.detail.slice(0, 21)}…`
                  : item.detail}
              </text>
              <title>
                {item.id} · {item.detail}
              </title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
