import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { registerBrowserTools } from './browser.mjs';

// No arbitrary URLs, JavaScript execution, shell execution, or token disclosure.
const base = new URL(process.env.ARENA_BASE_URL ?? 'http://127.0.0.1:8787');
if (base.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
    || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
  throw new Error('ARENA_BASE_URL must be a plain HTTP loopback origin');
}
const sessions = new Map();
const server = new McpServer({ name: 'skyscraper-arena', version: '0.1.0' });
const identifier = z.string().min(1).max(128);
const handleSchema = { handle: identifier.describe('Opaque local handle returned by Session.create/join; not a player credential.') };
const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('equip'), actorId: identifier, appearance: z.object({
    outfit: z.enum(['scholar', 'warden']), hair: z.enum(['ivory', 'midnight']), weapon: z.boolean(),
  }).strict() }).strict(),
  z.object({ type: z.literal('move'), actorId: identifier, roomId: identifier }).strict(),
  ...['gather', 'deliver', 'attack', 'capture'].map(type => z.object({ type: z.literal(type), actorId: identifier }).strict()),
  z.object({ type: z.literal('build'), roomId: identifier, kind: z.enum(['tower', 'catalog']) }).strict(),
  z.object({ type: z.literal('rule'), preset: z.enum(['gather', 'defend', 'explore']), retreatHp: z.number().int().min(0).max(100) }).strict(),
]);
async function request(path, body, token) {
  const response = await fetch(new URL(path, base), {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
    redirect: 'error',
  });
  if (!response.ok) {
    // Do not propagate arbitrary HTTP content which might contain credentials.
    throw new Error(`Arena authority rejected request (HTTP ${response.status})`);
  }
  return response.json();
}
function credentials(handle) {
  const credential = sessions.get(handle);
  if (!credential) throw new Error('Unknown session handle; create or join a session first');
  return credential;
}
function sessionPath(credential, suffix) {
  return `/api/sessions/${encodeURIComponent(credential.sessionId)}/${suffix}`;
}
async function saveSession(path, body) {
  const credential = await request(path, body);
  const handle = randomUUID();
  sessions.set(handle, credential);
  return { handle, sessionId: credential.sessionId, playerId: credential.playerId };
}
async function state(handle) {
  const credential = credentials(handle);
  return request(sessionPath(credential, 'state'), undefined, credential.token);
}
async function command(handle, input) {
  const credential = credentials(handle);
  return request(sessionPath(credential, 'commands'), input, credential.token);
}
function tool(name, description, inputSchema, run, readOnly = false) {
  server.registerTool(name, {
    description, inputSchema,
    annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, openWorldHint: false },
  }, async args => {
    try {
      return { content: [{ type: 'text', text: JSON.stringify(await run(args)) }] };
    } catch (error) {
      // Fixed SDK/API messages only, no stack or credentials on stdout.
      const message = error.message?.startsWith('Arena authority rejected')
        || error.message?.startsWith('Unknown session handle')
        ? error.message : 'Arena request failed; check the local authority is running';
      return { isError: true, content: [{ type: 'text', text: message }] };
    }
  });
}
tool('Session.create', 'Create an isolated training session or an online room. Credentials stay in MCP process memory; returned handle expires when this process exits.',
  { mode: z.enum(['training', 'online']), seed: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional() },
  args => saveSession('/api/sessions', args));
tool('Session.join', 'Join an existing online room as a new player. Training rooms are private. This is not reconnect: reuse the same handle to reconnect.',
  { sessionId: identifier }, args => saveSession(`/api/sessions/${encodeURIComponent(args.sessionId)}/join`, {}));
tool('Session.getState', 'Get authoritative state for this handle, including actors, map, rules, and outcome.', handleSchema, args => state(args.handle), true);
tool('Simulation.command', 'Issue a player action. The authority validates ownership, resources, adjacency and game phase. No direct state mutation.',
  { ...handleSchema, command: commandSchema }, args => command(args.handle, args.command));
tool('Simulation.pause', 'Training ONLY: pause/resume the local simulation. Online clock control is forbidden and rejected by the authority.',
  { ...handleSchema, paused: z.boolean() }, args => command(args.handle, { type: 'pause', paused: args.paused }));
tool('Simulation.step', 'Training ONLY: advance 1–120 ticks while paused. Online clock control is forbidden and rejected by the authority.',
  { ...handleSchema, ticks: z.number().int().min(1).max(120) }, args => command(args.handle, { type: 'step', ticks: args.ticks }));
tool('Simulation.reset', 'Training ONLY: reset to the original seed and pause. Credentials survive. Online reset is forbidden and rejected by the authority.',
  handleSchema, args => command(args.handle, { type: 'reset' }));
for (const operation of ['compile', 'preview']) {
  tool(`Script.${operation}`, operation === 'compile'
    ? 'Compile TypeScript source files with the arena SDK; return diagnostics, bundle and source map.'
    : 'Run a TypeScript rule in independent V8 against the current player snapshot; return decision intents.',
  { ...handleSchema, files: z.record(z.string(), z.string()), entry: z.string().optional() },
  async ({ handle, files, entry }) => {
    const credential = credentials(handle);
    return request(sessionPath(credential, `scripts/${operation}`), { files, entry }, credential.token);
  }, true);
}
tool('Replay.getEvents', 'Read retained diagnostic events after an optional event ID. Only the latest 100 are retained; this is NOT a complete or persistent replay. IDs restart on training reset.',
  { ...handleSchema, afterId: z.number().int().min(0).optional() }, async args => {
    const snapshot = await state(args.handle);
    return { retainedOnly: true, persistent: false, tick: snapshot.tick, firstRetainedId: snapshot.events[0]?.id ?? null,
      events: snapshot.events.filter(event => event.id > (args.afterId ?? 0)) };
  }, true);
tool('Replay.export', 'Export the bounded versioned command recording and final snapshot. Private checkpoints retain recordings across restarts; public exports contain gameplay data only.',
  handleSchema, async args => {
    const credential = credentials(args.handle);
    return request(sessionPath(credential, 'replay'), undefined, credential.token);
  }, true);
registerBrowserTools(server);
await server.connect(new StdioServerTransport());
