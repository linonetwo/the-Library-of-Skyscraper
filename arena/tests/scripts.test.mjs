import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

const base = process.env.ARENA_BASE_URL ?? 'http://127.0.0.1:8787';
const enabled = process.env.ARENA_INTEGRATION === '1';
const hold = { 'main.ts': 'export function decide() { return { intents: [] }; }' };
const move = { 'main.ts': `
import type { RuleContext } from '@skyscraper/arena-script-sdk';
export function decide(ctx: RuleContext) {
  return { intents: ctx.squad.actors.filter(actor => actor.roomId === 'room-0').map(actor => ({
    type: 'move' as const, actorId: actor.id, roomId: 'room-1', priority: 50
  })) };
}` };

async function http(path, body, token) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result;
}
const route = (session, suffix, body) => http(`/api/sessions/${session.sessionId}/${suffix}`, body, session.token);
const command = (session, body) => route(session, 'commands', body);
const ownedActors = (snapshot, session) => snapshot.actors.filter(actor => actor.owner === session.playerId);
const actorProgress = (snapshot, session) => ownedActors(snapshot, session)
  .map(({ state, ...progress }) => progress);

test('HTTP publication drives ticks, holds empty intents, disables to preset and replays exactly', { skip: !enabled }, async () => {
  const session = await http('/api/sessions', { mode: 'training', seed: 23 });
  await command(session, { type: 'reset' });
  const published = await route(session, 'scripts/publish', { files: move });
  assert.deepEqual(published.compilation.diagnostics, []);
  const metadata = published.snapshot.players.find(player => player.id === session.playerId).script;
  assert.equal(metadata.sourceHash, published.compilation.bundle.sourceHash);
  assert.equal(metadata.entry, 'main.ts');
  assert.equal(metadata.publishedAtTick, 0);
  const moved = await command(session, { type: 'step', ticks: 1 });
  assert(ownedActors(moved, session).every(actor => actor.roomId === 'room-1'));
  const held = await route(session, 'scripts/publish', { files: hold });
  const heldAfter = await command(session, { type: 'step', ticks: 3 });
  assert.deepEqual(actorProgress(heldAfter, session), actorProgress(held.snapshot, session));
  const disabled = await route(session, 'scripts/disable', {});
  assert.equal(disabled.players.find(player => player.id === session.playerId).script, undefined);
  const resumed = await command(session, { type: 'step', ticks: 1 });
  assert(ownedActors(resumed, session).some(actor => actor.cargo > 0));
  const replay = await route(session, 'replay');
  const timeline = await route(session, 'replay/timeline');
  assert.deepEqual(replay.finalSnapshot, resumed);
  assert.deepEqual(timeline.frames.at(-1).snapshot, resumed);
  assert(!JSON.stringify(replay).includes(session.token));
});

async function nextSnapshot(session, afterTick) {
  const socket = new WebSocket(`${base.replace('http:', 'ws:')}/ws/${session.sessionId}?token=${session.token}`);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(new Error('online tick did not arrive')); }, 10000);
    socket.addEventListener('message', event => {
      const snapshot = JSON.parse(event.data);
      if (snapshot.tick <= afterTick) return;
      clearTimeout(timer);
      socket.close();
      resolve(snapshot);
    });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('online snapshot connection failed'));
    }, { once: true });
  });
}

test('HTTP online players bind independent rules and the clock executes both', { skip: !enabled }, async () => {
  const one = await http('/api/sessions', { mode: 'online', seed: 91 });
  const two = await http(`/api/sessions/${one.sessionId}/join`, {});
  // Move each actor toward room-1 via the hub, regardless of the pre-publication tick.
  const travel = { 'main.ts': move['main.ts'].replace(
    "actor.roomId === 'room-0'", "actor.roomId !== 'room-1'",
  ).replace("roomId: 'room-1'", "roomId: actor.roomId === 'room-0' ? 'room-1' : 'room-0'") };
  const first = await route(one, 'scripts/publish', { files: hold });
  const second = await route(two, 'scripts/publish', { files: travel });
  const later = await nextSnapshot(two, second.snapshot.tick + 2);
  assert.deepEqual(actorProgress(later, one), actorProgress(first.snapshot, one));
  assert(ownedActors(later, two).every(actor => actor.roomId === 'room-1'));
  const p1 = later.players.find(player => player.id === one.playerId);
  const p2 = later.players.find(player => player.id === two.playerId);
  assert.equal(p1.script.sourceHash, first.compilation.bundle.sourceHash);
  assert.equal(p2.script.sourceHash, second.compilation.bundle.sourceHash);
  assert.notEqual(p1.script.sourceHash, p2.script.sourceHash);
});

test('MCP publication and disable control real training decisions', { skip: !enabled }, async t => {
  const client = new Client({ name: 'arena-script-publication', version: '1.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../tools/server.mjs', import.meta.url))],
    env: { ...process.env, ARENA_BASE_URL: base },
  }));
  t.after(() => client.close());
  async function call(name, args) {
    const response = await client.callTool({ name, arguments: args });
    assert.notEqual(response.isError, true, response.content[0].text);
    return JSON.parse(response.content[0].text);
  }
  const session = await call('Session.create', { mode: 'training', seed: 31 });
  const args = { handle: session.handle };
  await call('Simulation.reset', args);
  const published = await call('Script.publish', { ...args, files: move });
  assert.equal(published.snapshot.players[0].script.sourceHash, published.compilation.bundle.sourceHash);
  const moved = await call('Simulation.step', { ...args, ticks: 1 });
  assert(ownedActors(moved, session).every(actor => actor.roomId === 'room-1'));
  await call('Script.publish', { ...args, files: hold });
  const held = await call('Simulation.step', { ...args, ticks: 2 });
  assert.deepEqual(actorProgress(held, session), actorProgress(moved, session));
  await call('Script.disable', args);
  const resumed = await call('Simulation.step', { ...args, ticks: 1 });
  assert(ownedActors(resumed, session).some(actor => actor.cargo > 0));
  assert.deepEqual((await call('Replay.export', args)).finalSnapshot, resumed);
});
