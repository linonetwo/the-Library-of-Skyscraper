import {tacticalActionSchemas,performTacticalAction,readTacticalState} from './browser-tactical.mjs';
import {customModuleActionSchemas,performCustomModuleAction,readCustomModuleState} from './browser-custom-modules.mjs';
import {recordingActionSchemas,performRecordingAction,readRecordingState,readRuleComparisonState} from './browser-recording.mjs';
import {compositionActionSchemas,performCompositionAction,readCompositionState} from './browser-composition.mjs';
import {fragmentActionSchemas,performFragmentAction,readFragmentState} from './browser-graph-fragments.mjs';
import { mobilityActionSchemas, performMobilityAction, readMobilityState, readMobilityAuthority } from './browser-mobility.mjs';
import {graphActionSchemas,performGraphAction,readGraphState} from './browser-rule-graph.mjs';
import {goalActionSchemas,performGoalAction,readGoalState} from './browser-goals.mjs';
import {behaviorActionSchemas,performBehaviorAction,readBehaviorState} from './browser-behavior.mjs';
import { expeditionActionSchemas, performExpeditionAction, readExpeditionState } from './browser-expedition.mjs';
import { serviceOrigin } from './origins.mjs';
import { mapActionSchemas, performMapAction, readMapState } from './browser-map.mjs';
import { z } from 'zod';
import { workshopActionSchemas, performWorkshopAction, readWorkshopState } from './browser-workshop.mjs';

// Local game UI adapter. Actions share the player's visible controls.
const uiURL = serviceOrigin(process.env.ARENA_UI_URL ?? 'http://127.0.0.1:5173', 'ARENA_UI_URL');
export function registerBrowserTools(server) {
  let browser;
  let page;
  const actionSchema = z.discriminatedUnion('type', [
    ...tacticalActionSchemas, ...customModuleActionSchemas, ...graphActionSchemas, ...goalActionSchemas, ...fragmentActionSchemas, ...compositionActionSchemas, ...recordingActionSchemas,
    ...expeditionActionSchemas,
    ...workshopActionSchemas,
    ...mapActionSchemas, ...mobilityActionSchemas,
    ...behaviorActionSchemas,
    ...['openReplay', 'closeReplay', 'playReplay', 'pauseReplay', 'locateReplayTaskSource', 'startTraining', 'resetTraining', 'resumeLatest', 'openLobby', 'openRules', 'openScripts', 'compileScript', 'previewScript', 'publishScript', 'disableScript', 'openScriptHistory', 'loadScriptVersion', 'restoreScriptVersion', 'closeLobby', 'gather', 'deliver', 'attack', 'capture'].map(type => z.object({ type: z.literal(type) }).strict()),
    z.object({ type: z.literal('seekReplay'), operationIndex: z.number().int().min(0) }).strict(),
    z.object({ type: z.literal('selectReplayTask'), index: z.number().int().min(0) }).strict(),
    z.object({ type: z.literal('editScript'), source: z.string() }).strict(),
    z.object({ type: z.literal('loadScriptTemplate'), template: z.enum(['recall', 'gather', 'defend', 'explore', 'memory-gather']) }).strict(),
    z.object({ type: z.literal('selectScriptVersion'), sourceHash: z.string() }).strict(),
    z.object({ type: z.literal('toggleScriptDiff'), enabled: z.boolean() }).strict(),
    ...['selectScriptFile', 'addScriptFile', 'setScriptEntry', 'selectScriptDiffFile']
      .map(type => z.object({ type: z.literal(type), file: z.string() }).strict()),
    z.object({ type: z.literal('resumeSession'), sessionId: z.string() }).strict(),
    z.object({ type: z.literal('selectActor'), role: z.enum(['scout', 'gatherer', 'guard']) }).strict(),
    z.object({ type: z.literal('chooseOutfit'), outfit: z.enum(['scholar', 'warden']) }).strict(),
    z.object({ type: z.literal('chooseHair'), hair: z.enum(['ivory', 'midnight']) }).strict(),
    z.object({ type: z.literal('toggleStaff'), equipped: z.boolean() }).strict(),
    z.object({ type: z.literal('setRule'), preset: z.enum(['gather', 'defend', 'explore']), retreatHp: z.number().int().min(0).max(100) }).strict(),
    z.object({ type: z.literal('zoom'), direction: z.enum(['in', 'out']) }).strict(),
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
      } catch (error) {
        if (name === 'Page.open') await close().catch(() => {});
        return { isError: true, content: [{ type: 'text',
          text: `${name}: ${error.message}` }] };
      }
    });
  }
  register('Page.open', 'Open the configured ARENA_UI_URL in headless Chromium.', {}, async () => {
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
    const buttons = await active.getByRole('button').evaluateAll(elements => elements
      .filter(button => {
        const style = getComputedStyle(button);
        const box = button.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.visibility !== 'collapse' && box.width > 0 && box.height > 0;
      })
      .map(button => ({ label: button.getAttribute('aria-label') || button.innerText.trim(),
        disabled: button.matches(':disabled') || button.closest('[aria-disabled]')?.getAttribute('aria-disabled') === 'true' })));
    const maps = await readMapState(active);
    const battlefields = await active.locator('.pixi-map').evaluateAll(maps =>
      maps.map(map => JSON.parse(map.dataset.actors || '[]')));
    const scriptVersions = await active.getByLabel('规则历史版本').locator('option').evaluateAll(options =>
      options.filter(option => option.value).map(option => ({ sourceHash: option.value, label: option.textContent })));
    const replayDialog = active.getByRole('dialog', { name: '书苑行迹 · 赛局回放' });
    const replay = await replayDialog.count() ? {
      status: await replayDialog.getByRole('status').allTextContents(),
      operationIndex: Number(await active.getByRole('slider', { name: '回放进度' }).inputValue()),
      maxOperationIndex: Number(await active.getByRole('slider', { name: '回放进度' }).getAttribute('max')),
      ruleState: await active.getByLabel('回放规则状态').innerText(),
      memory: await active.getByLabel('回放规则记忆').count() ? await active.getByLabel('回放规则记忆').innerText() : null,
      tasks: await active.getByLabel('回放任务队列').getByRole('listitem').allTextContents(),
    } : null;
    return { url: active.url(), customModules: await readCustomModuleState(active), tactical: await readTacticalState(active), mobility: await readMobilityState(active), mobilityAuthority: await readMobilityAuthority(active), graph: await readGraphState(active), fragments: await readFragmentState(active), composition: await readCompositionState(active), recording: await readRecordingState(active), comparison: await readRuleComparisonState(active), goals: await readGoalState(active), behavior: await readBehaviorState(active), expedition: await readExpeditionState(active), maps, workshop: await readWorkshopState(active), replay, text: (await active.locator('body').innerText()).slice(0, 20000), buttons, battlefields, scriptVersions };
  }, true);
  const perform = async ({ action }) => {
    const active = current();
    if (await performTacticalAction(active, action)) return { performed: action.type };
    if (await performCustomModuleAction(active, action)) return { performed: action.type };
    if (await performGraphAction(active, action)) return { performed: action.type };
    if (await performRecordingAction(active, action)) return { performed: action.type };
    if (await performCompositionAction(active, action)) return { performed: action.type };
    if (await performFragmentAction(active, action)) return { performed: action.type };
    if (await performGoalAction(active, action)) return { performed: action.type };
    if (await performBehaviorAction(active, action)) return { performed: action.type };
    if (await performExpeditionAction(active, action)) return { performed: action.type };
    if (await performMobilityAction(active, action)) return { performed: action.type };
    if (await performMapAction(active, action)) return { performed: action.type };
    if (await performWorkshopAction(active, action)) return { performed: action.type };
    const click = name => active.getByRole('button', { name, exact: true }).click();
    const menu = async name => {
      if (!await active.getByRole('navigation', { name: '游戏菜单' }).isVisible()) await click('菜单');
      await active.getByRole('navigation', { name: '游戏菜单' }).getByRole('button', { name, exact: true }).click();
    };
    const details = async () => {
      if (!await active.locator('.character-drawer').isVisible()) {
        const detailsButton = active.getByRole('button', { name: '角色详情', exact: true });
        await (await detailsButton.isVisible() ? detailsButton : active.getByRole('button', { name: '详情 / 换装', exact: true })).click();
      }
    };
    if (['chooseOutfit', 'chooseHair', 'toggleStaff', 'attack', 'capture'].includes(action.type)) await details();
    switch (action.type) {
      case 'openReplay': await menu('赛局日志'); await click('播放赛局回放'); break;
      case 'closeReplay': await click('返回实时赛局'); break;
      case 'playReplay': await click('播放回放'); break;
      case 'pauseReplay': await click('暂停回放'); break;
      case 'seekReplay': await active.getByRole('slider', { name: '回放进度' }).fill(String(action.operationIndex)); break;
      case 'selectReplayTask': await active.getByLabel('回放任务队列').getByRole('button').nth(action.index).click(); break;
      case 'locateReplayTaskSource': await click('定位任务来源'); break;
      case 'openScripts':
        await menu('AI 模块编辑');
        await active.getByRole('tab', { name: 'TypeScript', exact: true }).click();
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
        await active.getByText(operation === 'publish' ? 'TS 规则已接管小队' : '行动预设运行中', { exact: true }).waitFor();
        if(operation === 'publish') await active.getByRole('button', { name: '恢复行动预设', exact: true }).waitFor();
        break;
      }
      case 'loadScriptTemplate':
        await active.getByLabel('载入规则模板').selectOption(action.template);
        break;
      case 'openScriptHistory':
        if (await active.locator('.script-history').getAttribute('open') === null)
          await active.locator('.script-history summary').click();
        break;
      case 'selectScriptVersion':
        await active.getByLabel('规则历史版本').selectOption(action.sourceHash);
        await active.getByRole('button', { name: '载入为草稿', exact: true }).waitFor();
        break;
      case 'loadScriptVersion': await click('载入为草稿'); break;
      case 'restoreScriptVersion':
        await Promise.all([
          active.waitForResponse(response => response.url().endsWith('/scripts/rollback')),
          click('恢复此版本'),
        ]);
        break;
      case 'toggleScriptDiff':
        await active.getByLabel('查看与草稿差异').setChecked(action.enabled);
        break;
      case 'selectScriptDiffFile':
        await active.getByLabel('对比源码文件').selectOption(action.file);
        break;
      case 'selectScriptFile': {
        const name = action.file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        await active.getByRole('tab', { name: new RegExp(`^${name}(?: · 入口)?$`) }).click();
        break;
      }
      case 'addScriptFile':
        await active.getByLabel('新规则文件名').fill(action.file);
        await click('添加文件');
        break;
      case 'setScriptEntry':
        await active.getByLabel('规则入口文件').selectOption(action.file);
        break;
      case 'editScript':
        await active.evaluate(source => navigator.clipboard.writeText(source), action.source);
        await active.getByRole('textbox', { name: 'TypeScript规则源码' }).focus();
        await active.keyboard.press('ControlOrMeta+a');
        await active.keyboard.press('ControlOrMeta+v');
        await active.waitForFunction(source => {
          const session = JSON.parse(sessionStorage.getItem('arena-session'));
          const project = JSON.parse(localStorage.getItem(`arena-rule-project:${session.sessionId}:${session.playerId}`));
          return project.files[project.activeFile] === source;
        }, action.source);
        break;
      case 'resumeLatest': await click('继续上次远征'); break;
      case 'resumeSession': await click(`继续远征 ${action.sessionId}`); break;
      case 'startTraining':
        await click('开启训练远征');
        await active.getByRole('button', { name: '选择巡书使', exact: true }).waitFor();
        break;
      case 'resetTraining': await menu('训练控制'); await click('重置训练局'); await click('收起训练控制'); break;
      case 'openLobby': await menu('联机大厅'); break;
      case 'closeLobby': await click('关闭赛局入口'); break;
      case 'openRules': await menu('AI 模块编辑'); break;
      case 'selectActor':
        await click(`选择${{ scout: '巡书使', gatherer: '采撷师', guard: '守卷人' }[action.role]}`);
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
        await menu('AI 模块编辑');
        await active.getByRole('tab', { name: '行动预设', exact: true }).click();
        await active.locator('.presets button').nth(['gather', 'defend', 'explore'].indexOf(action.preset)).click();
        const range = active.getByRole('slider', { name: /生命值撤退阈值/ });
        if (await range.isVisible()) await range.fill(String(action.retreatHp));
        else {
          const threshold = active.getByRole('combobox', { name: '撤退阈值', exact: true });
          const values = await threshold.locator('option').evaluateAll(options => options.map(option => option.value));
          if (!values.includes(String(action.retreatHp))) throw new Error('Retreat threshold is not available in this UI');
          await threshold.selectOption(String(action.retreatHp));
        }
        await active.getByRole('button', { name: /确认并发布规则/ }).click();
        break;
      }
      case 'zoom': await click(action.direction === 'in' ? '放大地图' : '缩小地图'); break;
      
      case 'gather': await active.getByRole('region', { name: '选中角色操作', exact: true }).getByRole('button', { name: '采集', exact: true }).click(); break;
      case 'deliver': await active.getByRole('region', { name: '选中角色操作', exact: true }).getByRole('button', { name: '卸货入库', exact: true }).click(); break;
      case 'attack': await click('攻击'); break;
      case 'capture': await click('编目'); break;
    }
    return { performed: action.type };
  };
  register('Input.action', 'Perform a typed action through visible game controls.', { action: actionSchema }, perform);
  register('Page.captureScreenshot', 'Capture the current 1440×1000 game viewport as a PNG MCP image.', {},
    () => current().screenshot({ type: 'png', animations: 'disabled' }), true, true);
  register('Page.close', 'Close the isolated browser and discard its temporary session credentials.', {}, close);
  // The stdio transport itself terminates at EOF; cleanup on explicit close or
  // process signal also prevents child Chromium from remaining after clients exit.
  process.once('SIGTERM', () => { void close().finally(() => process.exit(0)); });
  process.once('SIGINT', () => { void close().finally(() => process.exit(0)); });
  process.stdin.once('end', () => { void close(); });
}
