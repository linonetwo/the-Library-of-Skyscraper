import { z } from 'zod';

// Local game UI adapter. Actions share the player's visible controls.
const uiURL = 'http://127.0.0.1:5173';
export function registerBrowserTools(server) {
  let browser;
  let page;
  const actionSchema = z.discriminatedUnion('type', [
    ...['startTraining', 'resumeLatest', 'openLobby', 'openRules', 'openScripts', 'compileScript', 'previewScript', 'publishScript', 'disableScript', 'closeLobby', 'gather', 'deliver', 'attack', 'capture'].map(type => z.object({ type: z.literal(type) }).strict()),
    z.object({ type: z.literal('editScript'), source: z.string() }).strict(),
    z.object({ type: z.literal('loadScriptTemplate'), template: z.enum(['recall', 'gather', 'defend', 'explore']) }).strict(),
    z.object({ type: z.literal('resumeSession'), sessionId: z.string() }).strict(),
    z.object({ type: z.literal('selectActor'), role: z.enum(['scout', 'gatherer', 'guard']) }).strict(),
    z.object({ type: z.literal('chooseOutfit'), outfit: z.enum(['scholar', 'warden']) }).strict(),
    z.object({ type: z.literal('chooseHair'), hair: z.enum(['ivory', 'midnight']) }).strict(),
    z.object({ type: z.literal('toggleStaff'), equipped: z.boolean() }).strict(),
    z.object({ type: z.literal('setRule'), preset: z.enum(['gather', 'defend', 'explore']), retreatHp: z.number().int().min(0).max(100) }).strict(),
    z.object({ type: z.literal('zoom'), direction: z.enum(['in', 'out']) }).strict(),
    z.object({ type: z.literal('selectRoom'), room: z.enum(['room-0', 'room-1', 'room-2', 'room-3', 'room-4', 'room-5', 'room-6']) }).strict(),
  ]);
  function current() {
    if (!page || page.isClosed()) throw new Error('Page is not open');
    return page;
  }
  async function close() {
    page = undefined;
    const previous = browser;
    browser = undefined;
    await previous?.close();
    return { closed: true };
  }
  function register(name, description, inputSchema, run, readOnly = false, image = false) {
    server.registerTool(name, { description, inputSchema,
      annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, openWorldHint: false },
    }, async args => {
      try {
        const result = await run(args);
        return { content: [image ? { type: 'image', data: result.toString('base64'), mimeType: 'image/png' }
          : { type: 'text', text: JSON.stringify(result) }] };
      } catch {
        if (name === 'Page.open') await close().catch(() => {});
        return { isError: true, content: [{ type: 'text',
          text: 'Browser action failed. Ensure the local UI (127.0.0.1:5173), authority (127.0.0.1:8787), and Playwright Chromium are available, and open the page before controlling it.' }] };
      }
    });
  }
  register('Page.open', 'Open Arena at 127.0.0.1:5173 in headless Chromium.', {}, async () => {
    await close();
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: uiURL });
    page = await context.newPage();
    page.setDefaultTimeout(7000);
    await page.goto(uiURL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '开启训练远征', exact: true }).waitFor();
    return { open: true, viewport: { width: 1440, height: 1000 } };
  });
  register('Page.getState', 'Read rendered text, controls and battlefield actor poses (position, direction, animation frame).', {}, async () => {
    const active = current();
    const buttons = [];
    for (const button of await active.getByRole('button').all()) {
      if (!await button.isVisible()) continue;
      buttons.push({ label: await button.getAttribute('aria-label') || (await button.innerText()).trim(),
        disabled: await button.isDisabled() });
    }
    const battlefields = await active.locator('.pixi-map').evaluateAll(maps =>
      maps.map(map => JSON.parse(map.dataset.actors || '[]')));
    return { text: (await active.locator('body').innerText()).slice(0, 20000), buttons, battlefields };
  }, true);
  register('Input.action', 'Control training, characters, outfits, TypeScript editing/publication, rules and gameplay through the UI.', { action: actionSchema }, async ({ action }) => {
    const active = current();
    const click = name => active.getByRole('button', { name, exact: true }).click();
    switch (action.type) {
      case 'openScripts':
        await click('行动规则');
        await click('编写 TypeScript 规则 →');
        await active.getByRole('textbox', { name: 'TypeScript规则源码' }).waitFor({ timeout: 20000 });
        break;
      case 'compileScript': await click('编译 TypeScript'); break;
      case 'previewScript': await click('试跑当前快照'); break;
      case 'publishScript':
      case 'disableScript': {
        const operation = action.type === 'publishScript' ? 'publish' : 'disable';
        await Promise.all([
          active.waitForResponse(response => response.url().endsWith(`/scripts/${operation}`), { timeout: 20000 }),
          click(operation === 'publish' ? '发布到战场' : '恢复行动预设'),
        ]);
        await active.getByRole('button', { name: '发布到战场', exact: true }).waitFor();
        break;
      }
      case 'loadScriptTemplate':
        await active.getByLabel('载入规则模板').selectOption(action.template);
        break;
      case 'editScript':
        await active.evaluate(source => navigator.clipboard.writeText(source), action.source);
        await active.getByRole('textbox', { name: 'TypeScript规则源码' }).focus();
        await active.keyboard.press('ControlOrMeta+a');
        await active.keyboard.press('ControlOrMeta+v');
        await active.waitForFunction(source => localStorage.getItem('arena-rule-draft') === source, action.source);
        break;
      case 'resumeLatest': await click('继续上次远征'); break;
      case 'resumeSession': await click(`继续远征 ${action.sessionId}`); break;
      case 'startTraining':
        await click('开启训练远征');
        await active.locator('.squad-card').first().waitFor();
        break;
      case 'openLobby': await click('联机大厅'); break;
      case 'closeLobby': await click('关闭赛局入口'); break;
      case 'openRules': await click('行动规则'); break;
      case 'selectActor':
        await active.locator('.squad-card').filter({ hasText: { scout: '巡书使', gatherer: '采撷师', guard: '守卷人' }[action.role] }).click();
        break;
      case 'chooseOutfit': await click({ scholar: '星墨学者', warden: '书库守卫' }[action.outfit]); break;
      case 'chooseHair': await click(action.hair === 'ivory' ? '月白发色' : '墨蓝发色'); break;
      case 'toggleStaff': {
        const checkbox = active.getByRole('checkbox', { name: '携带法杖' });
        if (await checkbox.isChecked() !== action.equipped) {
          await checkbox.click();
          await active.waitForFunction(equipped =>
            document.querySelector('.appearance-options input').checked === equipped, action.equipped);
        }
        break;
      }
      case 'setRule': {
        await click('行动规则');
        await active.locator('.presets button').nth(['gather', 'defend', 'explore'].indexOf(action.preset)).click();
        const range = active.getByRole('slider', { name: /生命值撤退阈值/ });
        await range.focus();
        await range.press('Home');
        for (let i = 0; i < action.retreatHp; i++) await range.press('ArrowRight');
        await active.getByRole('button', { name: /确认并发布规则/ }).click();
        break;
      }
      case 'zoom': await click(action.direction === 'in' ? '放大地图' : '缩小地图'); break;
      case 'selectRoom': await active.getByRole('combobox', { name: '定位地图房间' }).selectOption(action.room); break;
      case 'gather': await click('采集'); break;
      case 'deliver': await click('卸货入库'); break;
      case 'attack': await click('攻击'); break;
      case 'capture': await click('编目'); break;
    }
    return { performed: action.type };
  });
  register('Page.captureScreenshot', 'Capture the current 1440×1000 game viewport as a PNG MCP image.', {},
    () => current().screenshot({ type: 'png', animations: 'disabled' }), true, true);
  register('Page.close', 'Close the isolated browser and discard its temporary session credentials.', {}, close);
  // The stdio transport itself terminates at EOF; cleanup on explicit close or
  // process signal also prevents child Chromium from remaining after clients exit.
  process.once('SIGTERM', () => { void close().finally(() => process.exit(0)); });
  process.once('SIGINT', () => { void close().finally(() => process.exit(0)); });
  process.stdin.once('end', () => { void close(); });
}
