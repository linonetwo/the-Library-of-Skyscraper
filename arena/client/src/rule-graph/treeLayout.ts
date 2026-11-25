/** Visual-only DAG layers. Invalid cyclic drafts remain visible for repair. */
export function layoutDecisionNodes(
  nodes: readonly { id: string }[],
  edges: readonly { from: string; to: string }[],
) {
  const incoming = new Map(nodes.map((n) => [n.id, 0]));
  const children = new Map(nodes.map((n) => [n.id, [] as string[]]));
  for (const edge of edges)
    if (incoming.has(edge.from) && incoming.has(edge.to)) {
      children.get(edge.from)!.push(edge.to);
      incoming.set(edge.to, incoming.get(edge.to)! + 1);
    }
  const order = nodes.filter((n) => incoming.get(n.id) === 0).map((n) => n.id);
  const depth = new Map(nodes.map((n) => [n.id, 0]));
  for (let i = 0; i < order.length; i++)
    for (const child of children.get(order[i])!) {
      depth.set(child, Math.max(depth.get(child)!, depth.get(order[i])! + 1));
      incoming.set(child, incoming.get(child)! - 1);
      if (incoming.get(child) === 0) order.push(child);
    }
  for (const node of nodes) if (!order.includes(node.id)) order.push(node.id);
  const rows = new Map<number, number>();
  const positions = new Map<string, { x: number; y: number }>();
  for (const id of order) {
    const column = depth.get(id)!;
    const row = rows.get(column) ?? 0;
    positions.set(id, { x: 30 + column * 260, y: 60 + row * 145 });
    rows.set(column, row + 1);
  }
  return positions;
}
