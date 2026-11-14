import { chromium } from 'playwright';
import path from 'node:path';

const directory = path.resolve(process.argv[2] ?? '../../wiki/tiddlers');
const day = process.argv[3] ?? new Date().toISOString().slice(0, 10);
const source = `import type { RuleContext } from '@skyscraper/arena-script-sdk';

// 三人小队前往纸林，然后采集藏材。
export function decide(ctx: RuleContext) {
  return { intents: ctx.squad.actors.map(actor => ({
    type: actor.roomId === 'room-0' ? 'move' as const : 'gather' as const,
    actorId: actor.id,
    roomId: 'room-1',
    priority: 50,
    reason: '纸林采集行动',
  })) };
}`;
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  await page.goto(process.env.ARENA_UI_URL ?? 'http://127.0.0.1:5173/');
  await page.getByRole('button', { name: '开启训练远征' }).click();
  await page.getByRole('button', { name: '重置训练局' }).click();
  await page.getByRole('button', { name: '行动规则', exact: true }).click();
  await page.getByRole('button', { name: '编写 TypeScript 规则 →' }).click();
  const editor = page.getByRole('textbox', { name: 'TypeScript规则源码' });
  await editor.waitFor();
  await page.evaluate(text => navigator.clipboard.writeText(text), source);
  await editor.focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+v');
  await page.waitForFunction(text => localStorage.getItem('arena-rule-draft') === text, source);
  await page.getByRole('button', { name: '发布到战场' }).click();
  await page.getByLabel('当前规则版本').getByText('TS 规则已接管小队').waitFor();
  for (let tick = 0; tick < 2; tick++) {
    const advanced = page.waitForResponse(response => response.url().endsWith('/commands'));
    await page.getByRole('button', { name: '单步', exact: true }).click();
    await advanced;
  }
  await page.screenshot({ path: path.join(directory, `竞技场${day}TS规则发布实机.png`) });
  await page.getByRole('button', { name: '战场总览', exact: true }).click();
  await page.waitForFunction(() => {
    const actors = JSON.parse(document.querySelector('.pixi-map')?.dataset.actors ?? '[]');
    return actors.length === 3 && actors.every(actor => !actor.moving && actor.animation === 'walk-prototype');
  });
  await page.screenshot({ path: path.join(directory, `竞技场${day}持杖脚本采集实机.png`) });
  await page.goto(new URL('/animation-lab', page.url()).href);
  await page.getByRole('img').first().waitFor();
  await page.getByRole('button', { name: '暂停动画' }).click();
  await page.getByLabel('行走衣装').selectOption('warden');
  await page.screenshot({ path: path.join(directory, `竞技场${day}持杖八向动画实机.png`), fullPage: true });
  console.log(`Captured live TS publication, staff gathering, and eight-direction inspection: ${directory}`);
} finally {
  await browser.close();
}
