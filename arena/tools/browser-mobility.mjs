import { z } from 'zod';
const room = z.string().min(1).max(160);
export const mobilityActionSchemas = [
  z.object({ type: z.literal('chooseMobility'), kind: z.enum(['run', 'jump', 'climb']) }).strict(),
  z.object({ type: z.literal('setRunRoute'), viaRoomId: room, roomId: room }).strict(),
  z.object({ type: z.literal('selectMobilityEdge'), edgeId: room }).strict(),
  ...['confirmMobility', 'clearMobilityPreview'].map(type => z.object({ type: z.literal(type) }).strict()),
];
const names = { run: '疾跑', jump: '跃桥', climb: '攀梯' };
export async function performMobilityAction(page, action) {
  if (!mobilityActionSchemas.some(schema => schema.shape.type.value === action.type)) return false;
  const panel = page.locator('.mobility-commands');
  if (!await panel.isVisible()) throw new Error('Mobility controls are not available for the selected actor/map');
  if (!await panel.evaluate(element => element.open)) await panel.locator('summary').click();
  const choose = async kind => {
    const button = panel.getByRole('button', { name: names[kind], exact: true });
    if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
  };
  switch (action.type) {
    case 'chooseMobility': await choose(action.kind); break;
    case 'setRunRoute':
      await choose('run');
      await panel.getByLabel('疾跑途经房间', { exact: true }).selectOption(action.viaRoomId);
      await panel.getByLabel('疾跑最终目标', { exact: true }).selectOption(action.roomId);
      break;
    case 'selectMobilityEdge': await panel.getByLabel('机动专用通路', { exact: true }).selectOption(action.edgeId); break;
    case 'clearMobilityPreview': await panel.getByRole('button', { name: '清除路线预览', exact: true }).click(); break;
    case 'confirmMobility': {
      const confirm = panel.getByRole('button', { name: '确认机动', exact: true });
      if (await confirm.isDisabled()) throw new Error(await panel.getByRole('status').innerText());
      const response = page.waitForResponse(response => response.url().endsWith('/commands') && response.request().method() === 'POST');
      await confirm.click();
      if (!(await response).ok()) throw new Error('Authority rejected the visible mobility command');
      break;
    }
  }
  return true;
}
export async function readMobilityState(page) {
  return page.locator('.mobility-commands').evaluateAll(panels => panels.map(panel => ({
    open: panel.open,
    kind: [...panel.querySelectorAll('[aria-pressed]')].find(button => button.getAttribute('aria-pressed') === 'true')?.textContent?.trim() ?? null,
    choices: [...panel.querySelectorAll('select')].map(select => ({label: select.getAttribute('aria-label'), value: select.value,
      options: [...select.options].map(option => ({value:option.value,label:option.textContent}))})),
    reason: panel.querySelector('[role=status]')?.textContent ?? null,
    confirmDisabled: [...panel.querySelectorAll('button')].find(button => button.textContent === '确认机动')?.disabled ?? true,
  })));
}
