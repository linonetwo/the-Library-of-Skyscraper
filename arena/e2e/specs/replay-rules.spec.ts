import { openMenu, closeOverlay } from './hud-helpers';
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';

test('real rule history follows seeks, versions, reset, source jumps and playback', async ({page}) => {
 test.setTimeout(90000);
 await page.goto('/');
 await page.getByRole('button',{name:'开启训练远征'}).click();
  await openMenu(page, '训练控制');
 const data=await page.evaluate(async()=>{
  const auth=JSON.parse(sessionStorage.getItem('arena-session')!);
  const route=async(suffix:string,body?:unknown)=>{
   const r=await fetch('/api/sessions/'+auth.sessionId+'/'+suffix,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.token},body:body===undefined?undefined:JSON.stringify(body)});
   if(!r.ok)throw new Error(await r.text());return r.json();
  };
  const counter=(version:string)=>({files:{'main.ts':`import type { RuleContext } from '@skyscraper/arena-script-sdk'; export function decide(ctx: RuleContext) { return {intents:[],memoryPatch:{set:{version:'${version}',ticks:Number(ctx.memory.ticks??0)+1}},taskPatches:ctx.squad.actors.map(actor=>({type:'upsert' as const,task:{id:actor.id,actorId:actor.id,roomId:actor.roomId,kind:'gather' as const,priority:50,status:'running' as const,blockedReason:null}}))}; }`}});
  await route('commands',{type:'reset'});
  const a=await route('scripts/publish',counter('A'));
  await route('commands',{type:'step',ticks:2});
  await route('scripts/publish',counter('B'));
  await route('commands',{type:'step',ticks:1});
  await route('scripts/rollback',{sourceHash:a.compilation.bundle.sourceHash});
  await route('commands',{type:'step',ticks:1});
  await route('commands',{type:'reset'});
  await route('commands',{type:'step',ticks:1});
  await route('scripts/disable',{});
  return route('replay/timeline');
 });
 await openMenu(page, '赛局日志');
 await page.getByRole('button',{name:'播放赛局回放'}).click();
 const slider=page.getByRole('slider',{name:'回放进度'});
 const patches=data.ruleHistory.changes.filter((change:any)=>change.memoryPatch);
 expect(patches).toHaveLength(5);
 const memory=page.getByLabel('回放规则记忆');
 for(const [position,ticks,version] of [[0,1,'A'],[1,2,'A'],[2,1,'B'],[3,3,'A'],[4,1,'A']] as const){
  await slider.fill(String(patches[position].operationIndex));
  await expect(memory).toContainText(`"ticks": ${ticks}`);
  await expect(memory).toContainText(`"version": "${version}"`);
  await expect(page.getByLabel('回放任务队列').getByRole('listitem')).toHaveCount(3);
 }
 const reset=data.ruleHistory.changes.filter((change:any)=>change.reset).at(-1);
 await slider.fill(String(reset.operationIndex));
 await expect(memory).toHaveText('{}');
 await expect(page.getByLabel('回放任务队列').getByRole('listitem')).toHaveCount(0);
 await slider.fill(String(data.frames.length-1));
 await expect(memory).toHaveText('{}');
 await expect(page.getByLabel('回放任务队列').getByRole('listitem')).toHaveCount(3);
 await page.getByLabel('回放任务队列').getByRole('button').first().click();
 await expect(page.getByLabel('回放任务详情')).toBeVisible();
 await page.getByRole('button',{name:'定位任务来源',exact:true}).click();
 await expect(slider).toHaveValue(String(patches[4].operationIndex));
 await slider.fill('0');
 await page.getByRole('button',{name:'播放回放',exact:true}).click();
 await expect.poll(async()=>Number(await slider.inputValue())).toBeGreaterThan(0);
 await page.getByRole('button',{name:'暂停回放',exact:true}).click();
 await slider.fill(String(patches[3].operationIndex));
 await page.getByLabel('回放任务队列').getByRole('button').first().click();
 if(process.env.ARENA_CAPTURE_DAY){
  await page.getByLabel('回放规则状态').scrollIntoViewIfNeeded();
  const dest=path.resolve('../../wiki/tiddlers/竞技场2026-11-15任务回放实机.png');
  await page.screenshot({path:dest,fullPage:true});
  await writeFile(dest+'.meta','title: 竞技场2026-11-15任务回放实机.png\ntype: image/png\n');
 }
 await page.getByRole('button',{name:'返回实时赛局'}).click();
 await page.route('**/replay/timeline',async route=>{const {ruleHistory,...legacy}=data;await route.fulfill({json:legacy});});
 await page.getByRole('button',{name:'播放赛局回放'}).click();
 await expect(page.getByLabel('回放规则状态')).toContainText('此回放未记录私有状态');
});
