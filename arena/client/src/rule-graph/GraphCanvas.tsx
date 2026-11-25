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
  const visited = new Set(trace?.actors.flatMap(a => a.visited.map(n => n.nodeId)));
  const selectedPath = new Set(trace?.actors.flatMap(a => [a.selectedNodeId,a.endStateId]));
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
          label: `${t.id} · P${t.priority}`,
        }))
      : nodes.flatMap((n) =>
          nodeEdges(n).map((edge, i) => ({
            id: `${n.id}-${i}`,
            from: n.id,
            to: edge.target,
            label: edge.label,
          })),
        );
  const position = new Map(
    items.map((item, i) => [
      item.id,
      { x: 30 + (i % 3) * 230, y: 28 + Math.floor(i / 3) * 135 },
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
        width="740"
        height={Math.max(250, Math.ceil(items.length / 3) * 135 + 40)}
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
          const x = start.x + 170,
            y = start.y + 38,
            tx = end?.x ?? x + 35,
            ty = end ? end.y + 38 : y + 34;
          return (
            <g
              key={edge.id}
              data-edge-id={edge.id}
              data-from={edge.from}
              data-to={edge.to}
              data-port={edge.label}
              className={!end ? "graph-edge dangling" : "graph-edge"}
            >
              <path
                d={`M${x},${y} C${x + 60},${y} ${tx - 50},${ty} ${tx},${ty}`}
                markerEnd="url(#rule-edge-arrow)"
              />
              <text x={(x + tx) / 2} y={(y + ty) / 2 - 7}>
                {edge.label}
                {!end ? " · 引用缺失" : ""}
              </text>
              {mode === "states" && <title>{edge.id}</title>}
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
