export function context(actorChanges = {}, roomChanges = {}) {
  const actor = {
    id: 'p1-gatherer', owner: 'p1', role: 'gatherer', roomId: 'room-0',
    hp: 100, maxHp: 100, state: 'idle', cargo: 0, cargoCapacity: 24,
    appearance: { outfit: 'scholar', hair: 'ivory', weapon: true },
    ...actorChanges,
  };
  const kinds = ['base', 'resource', 'catalog', 'ruins', 'resource', 'catalog', 'ruins'];
  const coordinates = [[0, 0], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  return {
    tick: 10,
    player: { id: 'p1', name: '司书 1', materials: 40, score: 0, rule: { preset: 'gather', retreatHp: 30 } },
    squad: { actors: [actor] },
    world: {
      rooms: kinds.map((kind, i) => ({
        id: `room-${i}`, q: coordinates[i][0], r: coordinates[i][1], kind,
        name: `书苑房间 ${i}`, resources: kind === 'resource' ? 180 : 0,
        enemyHp: kind === 'ruins' ? 60 : 0, owner: null, ...roomChanges[`room-${i}`],
      })),
      actors: [actor], buildings: [],
    },
    tasks: { items: [] },
    memory: {},
    limits: { maxIntents: 6, maxTaskPatches: 32, maxLogEntries: 64, maxMemoryBytes: 65536, remainingBudgetTokens: 1000 },
  };
}

export function freeze(value) {
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') freeze(nested);
  }
  return Object.freeze(value);
}
