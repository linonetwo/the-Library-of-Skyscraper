import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '../tools/node_modules/playwright/index.mjs';
import { Client } from '../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

const browserPresent = existsSync(chromium.executablePath());
test('MCP browser opens UI, trains, outfits, rules, map and captures PNG', {
  skip: process.env.ARENA_BROWSER !== '1' ? 'Set ARENA_BROWSER=1 with UI and authority running'
    : !browserPresent ? 'Playwright Chromium is not installed: run npx playwright install chromium' : false,
  timeout: 60000,
}, async t => {
  const client = new Client({ name: 'arena-browser-test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath, args: [fileURLToPath(new URL('../tools/server.mjs', import.meta.url))],
    env: process.env, stderr: 'pipe',
  }));
  t.after(() => client.close());
  async function call(name, args = {}) {
    const response = await client.callTool({ name, arguments: args });
    assert.notEqual(response.isError, true, response.content[0].text);
    return response;
  }
  const action = input => call('Input.action', { action: input });
  await call('Page.open');
  t.after(async () => {
    try { await call('Page.close'); } catch { /* transport may already be closed */ }
  });
  await action({ type: 'startTraining' });
  await action({ type: 'selectActor', role: 'guard' });
  await action({ type: 'chooseOutfit', outfit: 'scholar' });
  await action({ type: 'chooseHair', hair: 'midnight' });
  await action({ type: 'toggleStaff', equipped: false });
  await action({ type: 'selectRoom', room: 'room-1' });
  await action({ type: 'zoom', direction: 'in' });
  await action({ type: 'setRule', preset: 'defend', retreatHp: 35 });
  const state = JSON.parse((await call('Page.getState')).content[0].text);
  assert.match(state.text, /35%/);
  assert(state.buttons.length > 5);
  assert(!state.text.includes('"token"'));
  const screenshot = await call('Page.captureScreenshot');
  assert.equal(screenshot.content[0].type, 'image');
  assert.equal(screenshot.content[0].mimeType, 'image/png');
  const png = Buffer.from(screenshot.content[0].data, 'base64');
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert(png.length > 10000, 'screenshot contains the actual rendered game');
  await call('Page.close');
  const noPage = await client.callTool({ name: 'Page.getState', arguments: {} });
  assert.equal(noPage.isError, true);
});
