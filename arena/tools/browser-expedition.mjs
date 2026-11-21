import { z } from 'zod';

export const expeditionActionSchemas = [
  z.object({ type: z.literal('assignTask'), kind: z.enum(['gather', 'build', 'guard', 'return']),
    target: z.string().min(1), buildingKind: z.enum(['warehouse', 'tower', 'catalog']).optional() }).strict(),
  ...['startExpedition', 'pauseExpedition', 'retryExpedition', 'stepTraining'].map(type => z.object({ type: z.literal(type) }).strict()),
];

export async function performExpeditionAction(page, action) {
  const click = name => page.getByRole('button', { name, exact: true }).click();
  switch (action.type) {
    case 'assignTask': {
      if (action.kind === 'build' && !action.buildingKind) throw new Error('build task requires buildingKind');
      if (!await page.locator('.task-picker').isVisible()) await click('安排任务');
      const picker = page.locator('.task-picker');
      await picker.getByRole('button', { name: { gather: '采集运输', build: '建设', guard: '护卫编目', return: '返回据点' }[action.kind], exact: true }).click();
      if (action.kind === 'build') {
        const name = { warehouse: '前线仓库', tower: '防御塔', catalog: '编目台' }[action.buildingKind];
        await picker.locator('.build-kinds').getByRole('button', { name: new RegExp(`^${name}`) }).click();
      }
      // Match an explicit DOM room identifier; never infer room order or inject a command.
      const buttons = picker.locator('.task-targets button');
      const ids = await buttons.evaluateAll(items => items.map(item => item.dataset.roomId));
      const index = ids.indexOf(action.target);
      if (index < 0) throw new Error('Task target is not available in the visible task picker');
      await buttons.nth(index).click();
      break;
    }
    case 'startExpedition': await page.locator('.game-top').getByRole('button', { name: '开始远征', exact: true }).click(); break;
    case 'pauseExpedition': await page.locator('.game-top').getByRole('button', { name: '暂停', exact: true }).click(); break;
    case 'retryExpedition': await click('相同 seed 重试'); break;
    case 'stepTraining': {
      if (!await page.getByRole('button', { name: '单步', exact: true }).isVisible()) {
        await click('菜单'); await click('训练控制');
      }
      const step = page.getByRole('button', { name: '单步', exact: true }).and(page.locator('button:not(:disabled)'));
      await Promise.all([page.waitForResponse(response => response.url().endsWith('/commands') && response.request().method() === 'POST'), step.click()]);
      break;
    }
    default: return false;
  }
  return true;
}

export async function readExpeditionState(page) {
  const text = async selector => await page.locator(selector).count() ? page.locator(selector).first().innerText() : null;
  const actors = await page.locator('.pixi-map').evaluateAll(maps => maps.flatMap(map => JSON.parse(map.dataset.actors || '[]')));
  return {
    objective: await text('.objective-button'),
    status: await text('.game-top'),
    selectedActor: await text('.dock-summary'),
    squad: await page.locator('.dock-squad button').allTextContents(),
    tasks: actors.map(({ id, task, travel }) => ({ id, task: task ?? null, travel: travel ?? null })),
    taskTargets: await page.locator('.task-targets button').evaluateAll(items => items.map(item => ({ roomId: item.dataset.roomId, label: item.innerText, disabled: item.disabled }))),
    settlement: await text('.result-card'),
  };
}
