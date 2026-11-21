import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

test('MCP expedition task UI, travel and authority settlement reset', {
  skip: process.env.ARENA_EXPEDITION_BROWSER !== '1' ? 'Set ARENA_EXPEDITION_BROWSER=1 with candidate UI/authority' : false,
  timeout: 180000,
}, async t => {
  const client = new Client({ name: 'arena-expedition-test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath,
    args: [fileURLToPath(new URL('../tools/server.mjs', import.meta.url))], env: process.env, stderr: 'pipe' }));
  t.after(() => client.close());
  async function call(name, args = {}) {
    console.log('MCP START', args.action?.type ?? name);
    const response = await client.callTool({ name, arguments: args });
    console.log('MCP END', args.action?.type ?? name);
    assert.notEqual(response.isError, true, response.content[0].text);
    return JSON.parse(response.content[0].text);
  }
  const action = input => call('Input.action', { action: input });
  await call('Page.open');
  t.after(async () => { try { await call('Page.close'); } catch {} });
  await action({ type: 'startTraining' });
  for (const [role, kind, target, buildingKind] of [
    ['gatherer', 'gather', 'room-1'], ['guard', 'build', 'room-2', 'tower'], ['scout', 'guard', 'room-3'],
  ]) {
    await action({ type: 'selectActor', role });
    await action({ type: 'assignTask', kind, target, ...(buildingKind ? { buildingKind } : {}) });
  }
  let state = await call('Page.getState');
  assert.equal(state.expedition.tasks.filter(actor => actor.task).length, 3);
  assert.match(state.expedition.objective, /编目/);
  console.log('Three UI tasks assigned; rendered objective readable');
  await action({ type: 'startExpedition' });
  await action({ type: 'pauseExpedition' });
  await action({ type: 'stepTraining' });
  state = await call('Page.getState');
  assert(state.expedition.tasks.some(actor => actor.travel));
  console.log('Start/pause and UI single-step passed; actor travel readable');
  // Exercise authority-side stepping separately through its private MCP handle.
  const session = await call('Session.create', { mode: 'training', seed: 41 });
  const snapshot = await call('Session.getState', { handle: session.handle });
  const owned = snapshot.actors.find(actor => actor.owner === session.playerId);
  await call('Simulation.command', { handle: session.handle, command: { type: 'task', actorId: owned.id, kind: 'gather', target: 'room-1' } });
  await call('Simulation.step', { handle: session.handle, ticks: 2 });
  assert((await call('Session.getState', { handle: session.handle })).tick >= 2);
  console.log('Simulation.command task and Simulation.step passed against authority');
  let settled = await call('Session.getState', { handle: session.handle });
  for (let batch = 0; batch < 9 && !settled.result; batch++) {
    settled = await call('Simulation.step', { handle: session.handle, ticks: 120 });
  }
  assert(settled.result);
  await call('Simulation.reset', { handle: session.handle });
  const reset = await call('Session.getState', { handle: session.handle });
  assert.equal(reset.seed, settled.seed);
  assert.equal(reset.tick, 0);
  assert.equal(reset.result ?? null, null);
  console.log('Authority settlement and original-seed reset passed through private MCP handle');
});
