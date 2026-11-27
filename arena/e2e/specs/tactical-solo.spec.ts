import { test, expect } from '@playwright/test';
import { enabled, actor, at, bar, claimEvent, errors, evidence, keyboardDeparture, move, point, prepareDeparture, selectClaim, state, training, until } from './tactical-helpers';

test.describe('v0.7 normal-clock tactical acceptance', () => {
  test.skip(!enabled, 'Set ARENA_V070_ACCEPTANCE=1 for the fixed-package acceptance window.');
  test.setTimeout(90000);

  test('manual ink strike releases after two ticks through the real worker', async ({ page }, info) => {
    const pageErrors = errors(page);
    await training(page);
    await page.getByRole('button', { name: '选择守卷人', exact: true }).click();
    await page.getByLabel('撤退阈值', { exact: true }).selectOption('0');
    await move(page, 'room-3');
    await page.getByRole('button', { name: '开始远征', exact: true }).click();
    await until(page, s => at(s, 'p1-guard', 'room-3'));
    await bar(page).getByLabel('战术行动', { exact: true }).selectOption('cast');
    await bar(page).getByLabel('战术目标', { exact: true }).selectOption('drill-guardian-b');
    const response = page.waitForResponse(r => r.url().endsWith('/commands') && r.request().method() === 'POST');
    await bar(page).getByRole('button', { name: '确认定向墨印', exact: true }).click();
    const result = await response;
    expect(result.status()).toBe(200);
    const start = await result.json();
    const started = start.events.findLast((e: any) => e.tactical?.action === 'cast' && e.tactical.phase === 'started');
    expect(started).toBeTruthy();
    const releasedWorld = await until(page, s => s.events.some((e: any) => e.tactical?.actorId === 'p1-guard' && e.tactical.action === 'cast' && e.tactical.phase === 'released'), 6000);
    const released = releasedWorld.events.findLast((e: any) => e.tactical?.action === 'cast' && e.tactical.phase === 'released');
    expect(released.tick).toBe(started.tick + 2);
    expect(released.tactical.targetId).toBe('drill-guardian-b');
    expect(released.tactical.values.hpBefore - released.tactical.values.hpAfter).toBe(16);
    expect(released.tactical.targetPosition).toBeTruthy();
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await evidence(page, info, 'ink-release', { started, released, observedTick: releasedWorld.tick, paused: await state(page) });
    expect(pageErrors).toEqual([]);
  });

  test('paid repair consumes one material and restores four actual HP', async ({ page }, info) => {
    const pageErrors = errors(page);
    await training(page);
    await page.getByLabel('撤退阈值', { exact: true }).selectOption('0');
    for (const name of ['选择守卷人', '选择巡书使', '选择采撷师']) {
      await page.getByRole('button', { name, exact: true }).click();
      await move(page, 'room-3');
    }
    await page.getByRole('button', { name: '开始远征', exact: true }).click();
    await bar(page).getByLabel('战术行动', { exact: true }).selectOption('repair');
    const ready = await until(page, s => {
      const b = s.buildings.find((b: any) => b.id === 'p1-drill-warehouse');
      return at(s, 'p1-gatherer', 'room-3') && actor(s, 'p1-gatherer').hp > 0 && b.hp > 0 && b.hp < b.maxHp;
    });
    await bar(page).getByLabel('战术目标', { exact: true }).selectOption('p1-drill-warehouse');
    // Each visible confirmation takes one original approach step or one paid repair.
    let observed = ready;
    const deadline = Date.now() + 15000;
    while (!observed.events.some((e: any) => e.tactical?.actorId === 'p1-gatherer' && e.tactical.action === 'repair' && e.tactical.phase === 'applied') && Date.now() < deadline) {
      await bar(page).getByRole('button', { name: '确认修复', exact: true }).click();
      await page.waitForTimeout(250);
      observed = await state(page);
    }
    const applied = observed.events.findLast((e: any) => e.tactical?.actorId === 'p1-gatherer' && e.tactical.action === 'repair' && e.tactical.phase === 'applied');
    expect(applied).toBeTruthy();
    expect(applied.tactical.values.materialsBefore - applied.tactical.values.materialsAfter).toBe(1);
    expect(applied.tactical.values.hpAfter - applied.tactical.values.hpBefore).toBe(4);
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await evidence(page, info, 'paid-repair', { applied, observedTick: observed.tick, paused: await state(page) });
    expect(pageErrors).toEqual([]);
  });

  test('keyboard departure resets an unfinished claim on the next authority tick', async ({ page }, info) => {
    const pageErrors = errors(page);
    await training(page);
    await page.getByRole('button', { name: '选择采撷师', exact: true }).click();
    await move(page, 'room-2');
    await selectClaim(page);
    await page.getByRole('button', { name: '开始远征', exact: true }).click();
    await until(page, s => at(s, 'p1-gatherer', 'room-2'));
    const dispatch = await prepareDeparture(page);
    await bar(page).getByRole('button', { name: '确认占领', exact: true }).click();
    await dispatch.focus();
    await expect(dispatch).toBeFocused();
    const partial = await until(page, s => point(s).progressTicks >= 1, 6000);
    expect(partial.rooms.find((r: any) => r.id === 'room-2').owner).toBeNull();
    const departed = await keyboardDeparture(page, 'p1-gatherer');
    const resetWorld = await until(page, s => !!claimEvent(s, 'reset') && point(s).progressTicks === 0, 6000);
    const reset = claimEvent(resetWorld, 'reset');
    expect(reset.tick).toBe(departed.tick + 1);
    expect(reset.tactical.reasonCode).toBe('no-claimant');
    expect(resetWorld.rooms.find((r: any) => r.id === 'room-2').owner).toBeNull();
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await evidence(page, info, 'claim-reset', { partialTick: partial.tick, partialProgress: point(partial).progressTicks, dispatchTick: departed.tick, resetEvent: reset, observedTick: resetWorld.tick });
    expect(pageErrors).toEqual([]);
  });
});
