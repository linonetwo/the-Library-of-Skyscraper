import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

const base = process.env.ARENA_BASE_URL ?? 'http://127.0.0.1:8787';
const enabled = process.env.ARENA_INTEGRATION === '1';
const shuttle = {
  entry: 'main.ts',
  files: {
    'main.ts': `import type { RuleContext } from '@skyscraper/arena-script-sdk';
import { destination } from './strategy';
export function decide(ctx: RuleContext) {
  return { intents: ctx.squad.actors.map(actor => ({
    type: 'move' as const, actorId: actor.id, roomId: destination(actor.roomId), priority: 50,
  })) };
}`,
    'strategy.ts': `export const destination = (room: string) => room === 'room-0' ? 'room-1' : 'room-0';`,
  },
};
const hold = { files: { 'main.ts': 'export function decide() { return { intents: [] }; }' } };
async function http(path, body, token, status = 200) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return data;
}
const route = (session, suffix, body, status) =>
  http(`/api/sessions/${session.sessionId}/${suffix}`, body, session.token, status);
const rooms = snapshot => snapshot.actors.map(actor => actor.roomId);

test('HTTP version history retains projects and rollback replays actual decisions', { skip: !enabled }, async () => {
  const session = await http('/api/sessions', { mode: 'training', seed: 42 });
  await route(session, 'commands', { type: 'reset' });
  const a = await route(session, 'scripts/publish', shuttle);
  const hashA = a.compilation.bundle.sourceHash;
  const moved = await route(session, 'commands', { type: 'step', ticks: 1 });
  assert(moved.actors.every(actor => actor.travel?.targetRoomId === 'room-1')); 
  const b = await route(session, 'scripts/publish', hold);
  const hashB = b.compilation.bundle.sourceHash;
  const remaining = Math.max(...moved.actors.map(actor => Math.ceil((actor.travel.totalDistanceMilli - actor.travel.distanceMilli) / actor.travel.speedMilliPerTick)));
  const held = await route(session, 'commands', { type: 'step', ticks: remaining });
  assert.deepEqual(rooms(held), ['room-1', 'room-1', 'room-1']);
  assert(held.actors.every(actor => !actor.travel));
  const list = await route(session, 'scripts/versions');
  assert.equal(list.activeSourceHash, hashB);
  assert.equal(list.versions.length, 2);
  assert.equal(list.versions.find(version => version.sourceHash === hashB).parentSourceHash, hashA);
  const stored = await route(session, `scripts/versions/${hashA}`);
  assert.deepEqual(stored.project, shuttle);
  assert.equal(stored.version.sourceHash, hashA);
  const rolled = await route(session, 'scripts/rollback', { sourceHash: hashA });
  assert.equal(rolled.players[0].script.sourceHash, hashA);
  const resumed = await route(session, 'commands', { type: 'step', ticks: 1 });
  assert(resumed.actors.every(actor => actor.travel?.targetRoomId === 'room-0'));
  assert.equal((await route(session, 'scripts/versions')).versions.length, 2);
  const timeline = await route(session, 'replay/timeline');
  assert.deepEqual(timeline.frames.at(-1).snapshot, resumed);
  assert.deepEqual((await route(session, 'replay')).finalSnapshot, resumed);
});

test('HTTP version history and rollback belong to each online player', { skip: !enabled }, async () => {
  const one = await http('/api/sessions', { mode: 'online' });
  const two = await http(`/api/sessions/${one.sessionId}/join`, {});
  const a = await route(one, 'scripts/publish', shuttle);
  const b = await route(two, 'scripts/publish', hold);
  const hashA = a.compilation.bundle.sourceHash;
  const hashB = b.compilation.bundle.sourceHash;
  assert.deepEqual((await route(one, 'scripts/versions')).versions.map(version => version.sourceHash), [hashA]);
  assert.deepEqual((await route(two, 'scripts/versions')).versions.map(version => version.sourceHash), [hashB]);
  await route(two, `scripts/versions/${hashA}`, undefined, 404);
  await route(two, 'scripts/rollback', { sourceHash: hashA }, 404);
  const snapshot = await route(one, 'scripts/rollback', { sourceHash: hashA });
  assert.equal(snapshot.players.find(player => player.id === two.playerId).script.sourceHash, hashB);
});

test('MCP lists, retrieves and rolls back multi-file script versions', { skip: !enabled }, async t => {
  const client = new Client({ name: 'arena-script-versions', version: '1.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../tools/server.mjs', import.meta.url))],
    env: { ...process.env, ARENA_BASE_URL: base },
  }));
  t.after(() => client.close());
  async function call(name, args) {
    const result = await client.callTool({ name, arguments: args });
    assert.notEqual(result.isError, true, result.content[0].text);
    return JSON.parse(result.content[0].text);
  }
  const session = await call('Session.create', { mode: 'training' });
  const args = { handle: session.handle };
  await call('Simulation.reset', args);
  const a = await call('Script.publish', { ...args, ...shuttle });
  const hashA = a.compilation.bundle.sourceHash;
  const outward = await call('Simulation.step', { ...args, ticks: 1 });
  await call('Script.publish', { ...args, ...hold });
  const remaining = Math.max(...outward.actors.map(actor => Math.ceil((actor.travel.totalDistanceMilli - actor.travel.distanceMilli) / actor.travel.speedMilliPerTick)));
  await call('Simulation.step', { ...args, ticks: remaining });
  assert.equal((await call('Script.listVersions', args)).versions.length, 2);
  const version = await call('Script.getVersion', { ...args, sourceHash: hashA });
  assert.deepEqual(version.project, shuttle);
  await call('Script.rollback', { ...args, sourceHash: hashA });
  const resumed = await call('Simulation.step', { ...args, ticks: 1 });
  assert(resumed.actors.every(actor => actor.travel?.targetRoomId === 'room-0'));
  assert.deepEqual((await call('Replay.export', args)).finalSnapshot, resumed);
});
