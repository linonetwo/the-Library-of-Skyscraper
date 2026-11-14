import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Client } from '../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

export async function connect(baseURL) {
  const client = new Client({ name: 'arena-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../tools/server.mjs', import.meta.url))],
    env: { ...process.env, ARENA_BASE_URL: baseURL },
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', data => { stderr += data; });
  await client.connect(transport);
  return { client, transport, stderr: () => stderr };
}
export async function call(client, name, args) {
  const response = await client.callTool({ name, arguments: args });
  assert.notEqual(response.isError, true, response.content?.[0]?.text);
  return JSON.parse(response.content[0].text);
}
test('official MCP initialize, tools/list, tools/call and private credentials', async t => {
  const requests = [];
  const authority = createServer(async (req, res) => {
    let data = '';
    for await (const chunk of req) data += chunk;
    requests.push({ path: req.url, auth: req.headers.authorization, body: data ? JSON.parse(data) : null });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/sessions') {
      res.end(JSON.stringify({ sessionId: 'session-1', playerId: 'p1', token: 'PRIVATE_TEST_TOKEN' }));
    } else {
      res.end(JSON.stringify({ tick: 3, events: [{ id: 1 }, { id: 2 }] }));
    }
  });
  await new Promise(resolve => authority.listen(0, '127.0.0.1', resolve));
  t.after(() => authority.close());
  const connection = await connect(`http://127.0.0.1:${authority.address().port}`);
  t.after(() => connection.client.close());
  const tools = await connection.client.listTools();
  assert.equal(tools.tools.length, 13);
  assert(tools.tools.find(tool => tool.name === 'Simulation.step').description.includes('Online'));
  const created = await call(connection.client, 'Session.create', { mode: 'training', seed: 42 });
  assert.equal(created.playerId, 'p1');
  assert.equal(created.token, undefined);
  const snapshot = await call(connection.client, 'Session.getState', { handle: created.handle });
  assert.equal(snapshot.tick, 3);
  assert.equal(requests[1].auth, 'Bearer PRIVATE_TEST_TOKEN');
  const events = await call(connection.client, 'Replay.getEvents', { handle: created.handle, afterId: 1 });
  assert.equal(events.retainedOnly, true);
  assert.deepEqual(events.events, [{ id: 2 }]);
  const missing = await connection.client.callTool({ name: 'Session.getState', arguments: { handle: 'not-known' } });
  assert.equal(missing.isError, true);
  assert.equal(requests.length, 3);
  assert(!connection.stderr().includes('PRIVATE_TEST_TOKEN'));
  const invalid = await connection.client.callTool({ name: 'Simulation.step', arguments: { handle: created.handle, ticks: 121 } });
  assert.equal(invalid.isError, true);
  assert.equal(requests.length, 3);
});
test('MCP refuses remote origins and URL credentials before transport starts', async () => {
  for (const baseURL of ['https://example.com', 'http://example.com', 'http://user:secret@localhost:8787', 'http://localhost:8787/api']) {
    const child = spawn(process.execPath, [fileURLToPath(new URL('../tools/server.mjs', import.meta.url))], {
      env: { ...process.env, ARENA_BASE_URL: baseURL }, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.resume();
    const code = await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); });
    assert.notEqual(code, 0);
    assert.equal(output, '');
  }
});
