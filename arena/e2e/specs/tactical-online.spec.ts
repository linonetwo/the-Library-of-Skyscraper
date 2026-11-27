import { test, expect } from '../twoClientFixture';
import { openMenu } from './hud-helpers';
import { enabled, at, bar, claim, claimEvent, errors, evidence, keyboardDeparture, move, point, prepareDeparture, sixTickCapture, state, until } from './tactical-helpers';

test.describe('v0.7 normal-clock two-owner tactical acceptance', () => {
  test.skip(!enabled, 'Set ARENA_V070_ACCEPTANCE=1 for the fixed-package acceptance window.');
  // Ordinary-clock round trips and two six-tick claims take about 100 seconds.
  test.setTimeout(180000);

  test('contested point, P1 capture/departure, P2 six-tick retake and twenty-point victory', async ({ pairedContexts: [one, two] }, info) => {
    const a = await one.newPage();
    const b = await two.newPage();
    const pageErrors = [errors(a), errors(b)];
    await a.goto('/');
    await openMenu(a, '联机大厅');
    await a.getByLabel('创建赛局场景', { exact: true }).selectOption('seal-contest');
    await a.getByRole('button', { name: /^创建联机/ }).click();
    await expect(bar(a)).toBeVisible();
    const initial = await state(a);
    expect(initial.mode).toBe('online');
    expect(initial.scenarioId).toBe('seal-contest');
    expect(initial.paused).toBe(false);
    await b.goto('/');
    await openMenu(b, '联机大厅');
    await b.getByLabel('使用赛局编号加入', { exact: true }).fill(initial.sessionId);
    await b.getByRole('button', { name: '加入赛局', exact: true }).click();
    await expect(bar(b)).toBeVisible();
    for (const page of [a, b]) {
      await page.getByRole('button', { name: '选择采撷师', exact: true }).click();
      await move(page, 'room-2');
    }
    await until(a, s => at(s, 'p1-gatherer', 'room-2') && at(s, 'p2-gatherer', 'room-2'));
    await claim(a);
    await claim(b);
    const contested = await until(a, s => point(s).contested && point(s).progressTicks === 0);
    await evidence(a, info, 'contested', contested);

    const dispatch = await prepareDeparture(a);
    await dispatch.focus();
    await expect(dispatch).toBeFocused();
    await move(b, 'room-0');
    const firstWorld = await until(a, s => !!claimEvent(s, 'captured', 'p1'), 10000);
    const first = claimEvent(firstWorld, 'captured', 'p1');
    sixTickCapture(firstWorld, first);
    const departed = await keyboardDeparture(a, 'p1-gatherer');
    expect(departed.players.find((p: any) => p.id === 'p1').score).toBeLessThan(20);
    await a.getByRole('button', { name: '关闭房间详情', exact: true }).click();
    const home = await until(a, s => at(s, 'p1-gatherer', 'room-0') && at(s, 'p2-gatherer', 'room-0'));
    const p1Score = home.players.find((p: any) => p.id === 'p1').score;
    expect(p1Score).toBeLessThan(20);

    await move(b, 'room-2');
    await until(a, s => at(s, 'p2-gatherer', 'room-2'));
    await claim(b);
    const retakeWorld = await until(a, s => !!claimEvent(s, 'captured', 'p2'), 10000);
    const retake = claimEvent(retakeWorld, 'captured', 'p2');
    expect(retake.tactical.values.previousOwnerId).toBe('p1');
    sixTickCapture(retakeWorld, retake);
    await evidence(b, info, 'p2-retaken', { first, departureTick: departed.tick, retake, observedTick: retakeWorld.tick });
    const settled = await until(a, s => s.phase === 'settled', 15000);
    expect(settled.players.find((p: any) => p.id === 'p2').score).toBe(20);
    expect(settled.players.find((p: any) => p.id === 'p1').score).toBe(p1Score);
    expect(settled.result.winner).toBe('p2');
    await evidence(b, info, 'p2-victory', settled);
    expect(pageErrors.flat()).toEqual([]);
  });
});
