import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { request as rawRequest } from 'node:http';

const base = process.env.ARENA_BASE_URL ?? 'http://127.0.0.1:8787';
const enabled = process.env.ARENA_INTEGRATION === '1';
async function http(path, body, token, status = 200) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, status, `HTTP ${path}`);
  return response.json();
}
const create = (mode, seed = 42) => http('/api/sessions', { mode, seed });
const state = (c, status = 200) => http(`/api/sessions/${c.sessionId}/state`, undefined, c.token, status);
const command = (c, body, status = 200) => http(`/api/sessions/${c.sessionId}/commands`, body, c.token, status);
test('HTTP: replay export requires ownership, excludes credentials and records accepted commands', { skip: !enabled }, async () => {
  const session = await create('training', 71);
  const other = await create('training', 72);
  await command(session, { type: 'reset' });
  await command(session, { type: 'step', ticks: 8 });
  const route = `/api/sessions/${session.sessionId}/replay`;
  await http(route, undefined, undefined, 401);
  await http(route, undefined, other.token, 401);
  const recording = await http(route, undefined, session.token);
  assert.equal(recording.version, 1);
  assert.equal(recording.finalSnapshot.tick, 8);
  assert.equal(recording.operations.filter(operation => operation.type === 'advance').length, 8);
  assert(!JSON.stringify(recording).includes(session.token));
  assert.deepEqual(recording.finalSnapshot, await state(session));
});
function firstSnapshot(credential, afterTick = -1) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${base.replace('http:', 'ws:')}/ws/${credential.sessionId}?token=${credential.token}`);
    const timeout = setTimeout(() => { socket.close(); reject(new Error('WebSocket snapshot timeout')); }, 5000);
    socket.addEventListener('message', event => {
      const snapshot = JSON.parse(event.data);
      if (snapshot.tick <= afterTick) return;
      clearTimeout(timeout); socket.close(); resolve(snapshot);
    });
    socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('WebSocket connection failed')); }, { once: true });
  });
}
test('HTTP/WS: two players share authority; ownership and online clock protection; reconnect', { skip: !enabled }, async () => {
  const one = await create('online');
  const two = await http(`/api/sessions/${one.sessionId}/join`, {});
  assert.notEqual(one.token, two.token);
  assert.equal(two.playerId, 'p2');
  await state({ ...one, token: 'invalid' }, 401);
  await command(two, { type: 'move', actorId: 'p1-scout', roomId: 'room-1' }, 400);
  for (const action of [{ type: 'pause', paused: true }, { type: 'step', ticks: 1 }, { type: 'reset' }]) {
    await command(one, action, 400);
  }
  await command(one, { type: 'rule', preset: 'defend', retreatHp: 37 });
  const [first, second] = await Promise.all([firstSnapshot(one), firstSnapshot(two)]);
  assert.equal(first.sessionId, second.sessionId);
  assert.equal(first.players.length, 2);
  assert.deepEqual(first.players.find(p => p.id === 'p1').rule, { preset: 'defend', retreatHp: 37 });
  assert.deepEqual(second.players.find(p => p.id === 'p1').rule, { preset: 'defend', retreatHp: 37 });
  const reconnected = await firstSnapshot(two);
  assert.equal(reconnected.players.length, 2);
  assert(reconnected.tick >= second.tick);
  const later = await firstSnapshot(two, reconnected.tick);
  assert(later.tick > reconnected.tick, 'online authority clock advances after reconnect');
});
test('HTTP: private training, isolated clocks, deterministic reset and bounded commands', { skip: !enabled }, async () => {
  const one = await create('training', 123);
  const two = await create('training', 123);
  await command(one, { type: 'reset' });
  await command(two, { type: 'reset' });
  await http(`/api/sessions/${one.sessionId}/join`, {}, undefined, 403);
  await state({ ...one, token: two.token }, 401);
  for (const ticks of [0, 121]) await command(one, { type: 'step', ticks }, 400);
  const original = await state(one);
  const advanced = await command(one, { type: 'step', ticks: 8 });
  assert.equal((await state(two)).tick, 0);
  const comparable = snapshot => {
    const { sessionId, ...rest } = snapshot;
    return rest;
  };
  const other = await command(two, { type: 'step', ticks: 8 });
  assert.deepEqual(comparable(advanced), comparable(other));
  const reset = await command(one, { type: 'reset' });
  assert.deepEqual(comparable(reset), comparable(original));
  assert.deepEqual(comparable(await command(one, { type: 'step', ticks: 8 })), comparable(advanced));
  await command(one, { type: 'pause', paused: false });
  await command(one, { type: 'step', ticks: 1 }, 400);
  await command(one, { type: 'pause', paused: true });
});
test('MCP to real authority: training control, retained events and online rejection', { skip: !enabled }, async t => {
  const client = new Client({ name: 'arena-integration', version: '1.0.0' });
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
  const training = await call('Session.create', { mode: 'training', seed: 7 });
  await call('Simulation.reset', { handle: training.handle });
  const appearance = { outfit: 'warden', hair: 'midnight', weapon: false };
  const equipped = await call('Simulation.command', { handle: training.handle,
    command: { type: 'equip', actorId: 'p1-scout', appearance } });
  assert.deepEqual(equipped.actors.find(actor => actor.id === 'p1-scout').appearance, appearance);
  const stepped = await call('Simulation.step', { handle: training.handle, ticks: 4 });
  assert.equal(stepped.tick, 4);
  const files = { 'main.ts': `import type { RuleContext, RuleDecisionResult } from "@skyscraper/arena-script-sdk";
export function decide(ctx: RuleContext): RuleDecisionResult {
  return { intents: ctx.squad.actors.map(actor => ({
    type: "move", actorId: actor.id, roomId: "room-0", priority: 50
  })) };
}` };
  const compiled = await call('Script.compile', { handle: training.handle, files });
  assert.equal(compiled.diagnostics.length, 0);
  assert(compiled.bundle.sourceHash);
  const preview = await call('Script.preview', { handle: training.handle, files });
  assert.equal(preview.tick, 4);
  assert.equal(preview.execution.decision.intents.length, 3);
  assert.equal((await call('Session.getState', { handle: training.handle })).tick, 4);
  const events = await call('Replay.getEvents', { handle: training.handle });
  assert.equal(events.retainedOnly, true);
  const online = await call('Session.create', { mode: 'online' });
  const joined = await call('Session.join', { sessionId: online.sessionId });
  assert.equal(joined.playerId, 'p2');
  const denied = await client.callTool({ name: 'Simulation.pause', arguments: { handle: online.handle, paused: true } });
  assert.equal(denied.isError, true);
  const rule = { type: 'rule', preset: 'defend', retreatHp: 25 };
  await call('Simulation.command', { handle: online.handle, command: rule });
  const snapshot = await call('Session.getState', { handle: joined.handle });
  assert.equal(snapshot.players[0].rule.retreatHp, 25);
});
test('HTTP and WebSocket upgrade reject hostile Origin and Host', { skip: !enabled }, async () => {
  const credential = await create('online');
  for (const path of ['/api/sessions', `/api/sessions/${credential.sessionId}/join`]) {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { Origin: 'http://attacker.invalid', 'Content-Type': 'application/json' },
      body: JSON.stringify(path === '/api/sessions' ? { mode: 'online' } : {}),
    });
    assert.equal(response.status, 403);
  }
  const badHost = await new Promise((resolve, reject) => {
    const request = rawRequest(`${base}/health`, { headers: { Host: 'attacker.invalid:8787' } }, response => {
      response.resume(); resolve(response.statusCode);
    });
    request.on('error', reject);
    request.end();
  });
  assert.equal(badHost, 403);
  // A regular HTTP request with the exact WS path hits the same origin guard,
  // before upgrade parsing or token lookup. No token is included in diagnostics.
  const badWS = await fetch(`${base}/ws/${credential.sessionId}?token=${credential.token}`, {
    headers: { Origin: 'http://attacker.invalid' },
  });
  assert.equal(badWS.status, 403);
  const allowed = await fetch(`${base}/health`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});
