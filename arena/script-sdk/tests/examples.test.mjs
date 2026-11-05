import assert from 'node:assert/strict';
import test from 'node:test';
import { decide as gather } from '../examples/gather.ts';
import { decide as defend } from '../examples/defend.ts';
import { decide as explore } from '../examples/explore.ts';
import { context, freeze } from './fixture.mjs';

test('gather selects mine, gathers, returns full cargo, then delivers', () => {
  assert.deepEqual(gather(context()).intents, [
    { type: 'move', actorId: 'p1-gatherer', roomId: 'room-1', priority: 40 },
  ]);
  assert.equal(gather(context({ roomId: 'room-1' })).intents[0].type, 'gather');
  assert.deepEqual(gather(context({ roomId: 'room-1', cargo: 24 })).intents, [
    { type: 'move', actorId: 'p1-gatherer', roomId: 'room-0', priority: 80 },
  ]);
  assert.deepEqual(gather(context({ cargo: 24 })).intents, [
    { type: 'deliver', actorId: 'p1-gatherer', priority: 90 },
  ]);
});

test('depleted mine returns partial load and selects the remaining node', () => {
  const depleted = { 'room-1': { resources: 0 } };
  assert.equal(gather(context({ roomId: 'room-1', cargo: 8 }, depleted)).intents[0].roomId, 'room-0');
  assert.equal(gather(context({}, depleted)).intents[0].roomId, 'room-4');
  assert.equal(gather(context({ roomId: 'room-1' }, depleted)).intents[0].roomId, 'room-0');
  assert.deepEqual(gather(context({}, {
    ...depleted, 'room-4': { resources: 0 },
  })).intents, []);
  assert.equal(gather(context({ roomId: 'room-1' }, {
    ...depleted, 'room-4': { resources: 0 },
  })).intents[0].roomId, 'room-0');
});

test('low HP retreats with cargo, unloads at base, and waits for recovery', () => {
  assert.deepEqual(gather(context({ roomId: 'room-1', hp: 15, cargo: 8 })).intents, [
    { type: 'move', actorId: 'p1-gatherer', roomId: 'room-0', priority: 100 },
  ]);
  assert.equal(gather(context({ hp: 15, cargo: 8 })).intents[0].type, 'deliver');
  assert.deepEqual(gather(context({ hp: 15 })).intents, []);
  assert.deepEqual(gather(context({ hp: 0, roomId: 'room-3' })).intents, []);
});

test('defend returns to base, unloads cargo and engages local hostiles', () => {
  assert.equal(defend(context({ roomId: 'room-2' })).intents[0].roomId, 'room-0');
  assert.deepEqual(defend(context()).intents, []);
  assert.equal(defend(context({ cargo: 8 })).intents[0].type, 'deliver');
  assert.equal(defend(context({ roomId: 'room-3' })).intents[0].type, 'attack');
});

test('explore routes scout, guard and gatherer to their distinct objectives', () => {
  assert.equal(explore(context({ role: 'scout' })).intents[0].roomId, 'room-5');
  assert.equal(explore(context({ role: 'guard' })).intents[0].roomId, 'room-6');
  assert.equal(explore(context()).intents[0].roomId, 'room-4');
  assert.equal(explore(context({ roomId: 'room-4' })).intents[0].type, 'gather');
  assert.equal(explore(context({}, { 'room-4': { resources: 0 } })).intents[0].roomId, 'room-1');
});

test('catalogue follows combat and respects ownership and contesting squads', () => {
  const ctx = context({ role: 'scout', roomId: 'room-5' });
  assert.equal(explore(ctx).intents[0].type, 'capture');
  ctx.world.rooms[5].owner = 'p1';
  assert.deepEqual(explore(ctx).intents, []);
  ctx.world.rooms[5].owner = null;
  ctx.world.actors.push({ ...ctx.squad.actors[0], id: 'p2-scout', owner: 'p2' });
  assert.deepEqual(explore(ctx).intents, []);
  ctx.world.actors.pop();
  ctx.world.rooms[5].enemyHp = 20;
  assert.equal(explore(ctx).intents[0].type, 'attack');
});

test('priority allocation and actor IDs give deterministic output ordering', () => {
  const ctx = context({ id: 'p1-z', roomId: 'room-1' });
  ctx.squad.actors.push({ ...ctx.squad.actors[0], id: 'p1-a', roomId: 'room-0', cargo: 8 });
  ctx.limits.maxIntents = 1;
  assert.deepEqual(gather(ctx).intents, [{ type: 'deliver', actorId: 'p1-a', priority: 90 }]);
  ctx.squad.actors.reverse();
  assert.deepEqual(gather(ctx).intents, [{ type: 'deliver', actorId: 'p1-a', priority: 90 }]);
});

test('all examples are synchronous and leave deeply frozen input unchanged', () => {
  for (const decide of [gather, defend, explore]) {
    const ctx = freeze(context());
    const before = JSON.stringify(ctx);
    const first = decide(ctx);
    assert.equal(typeof first.then, 'undefined');
    assert.deepEqual(decide(ctx), first);
    assert.equal(JSON.stringify(ctx), before);
  }
});
