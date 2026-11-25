import type {
  GraphState,
  GraphTransition,
} from "../../../behavior-modules/graph";
export type StatePair = { normal: GraphState; recovery: GraphState };
export function layoutStates(
  states: readonly GraphState[],
  transitions: readonly GraphTransition[],
) {
  const repeatedNames = new Set(
    states
      .filter((s) => states.filter((other) => other.name === s.name).length > 1)
      .map((s) => s.name),
  );
  const pairs: StatePair[] = [];
  for (const recovery of states.filter((s) => repeatedNames.has(s.name))) {
    const exits = transitions.filter((t) => t.from === recovery.id);
    const entries = transitions.filter((t) => t.to === recovery.id);
    const normal = states.find((s) => s.id === exits[0]?.to);
    if (
      exits.length !== 1 ||
      entries.length !== 1 ||
      !normal ||
      repeatedNames.has(normal.name) ||
      entries[0].from !== normal.id
    )
      continue;
    pairs.push({ normal, recovery });
  }
  const paired =
    pairs.length > 1 &&
    pairs.length * 2 === states.length &&
    new Set(pairs.map((p) => p.normal.id)).size === pairs.length &&
    transitions.every(
      (edge) =>
        edge.from !== edge.to &&
        states.some((s) => s.id === edge.from) &&
        states.some((s) => s.id === edge.to),
    );
  if (!paired)
    return {
      positions: new Map(
        states.map((state, i) => [
          state.id,
          { x: 30 + (i % 3) * 230, y: 60 + Math.floor(i / 3) * 150 },
        ]),
      ),
      pairs: [] as StatePair[],
      nodeWidth: 170,
      nodeHeight: 76,
    };
  pairs.sort((a, b) => states.indexOf(a.normal) - states.indexOf(b.normal));
  const outer = transitions.filter(
    (t) =>
      !pairs.some(
        (p) =>
          [p.normal.id, p.recovery.id].includes(t.from) &&
          [p.normal.id, p.recovery.id].includes(t.to),
      ),
  );
  const left = Math.max(200, outer.length * 80 + 40);
  return {
    positions: new Map(
      pairs.flatMap((pair, row) => [
        [pair.normal.id, { x: left, y: 30 + row * 130 }] as const,
        [pair.recovery.id, { x: left + 350, y: 30 + row * 130 }] as const,
      ]),
    ),
    pairs,
    nodeWidth: 200,
    nodeHeight: 96,
  };
}
export type StateLayout = ReturnType<typeof layoutStates>;
