import {test} from 'node:test';
import assert from 'node:assert/strict';
import {expeditionObjective} from '../src/expeditionObjective.ts';
const actor={id:'p1-gatherer',owner:'p1',role:'gatherer',roomId:'resource',hp:100,cargo:24,state:'moving',task:{kind:'gather',target:'resource',stage:'travelling'},travel:{targetRoomId:'base'}};
const base={tick:40,paused:false,phase:'running',rooms:[{id:'base',kind:'base'},{id:'resource',kind:'resource',resources:100},{id:'target',kind:'ruins',name:'书库',enemyHp:0}],actors:[actor],buildings:[],events:[],enemies:[],scenarioConfig:{targetRoomId:'target',catalogGoal:60,buildingCosts:{catalog:25}},scenario:{catalogProgress:0,counterattackSpawned:false,counterattackTick:null}};
const player={id:'p1',materials:10};
test('carried cargo is not deposited construction material; focus actual return destination',()=>{
 const o=expeditionObjective(base,player);assert.match(o.title,/10\/25/);assert.match(o.detail,/携带24返程/);assert.equal(o.roomId,'base');
});
test('enemy materials and catalog do not satisfy own construction goal',()=>{
 const o=expeditionObjective({...base,buildings:[{owner:'p2',kind:'catalog',roomId:'target',hp:100,constructionTicks:16,requiredTicks:16}]},player);assert.match(o.title,/采集并入库/);
});
test('clear guardians before construction; completed own building enables catalog',()=>{
 assert.match(expeditionObjective({...base,enemies:[{id:'guardian-1',roomId:'target',hp:32}]},player).title,/剩余HP 32/);
 const s={...base,buildings:[{owner:'p1',kind:'catalog',roomId:'target',hp:100,constructionTicks:7,requiredTicks:16}]};assert.match(expeditionObjective(s,player).title,/施工43% · 还需5秒/);
 s.buildings[0].constructionTicks=16;assert.match(expeditionObjective(s,player).title,/驻守编目 · 0\/60/);
});
test('preparation, counterattack countdown, threat room and settled outcome derive from snapshot',()=>{
 assert.match(expeditionObjective({...base,tick:0,paused:true},player).title,/开始远征/);
 const s={...base,buildings:[{owner:'p1',kind:'catalog',roomId:'target',hp:100}],scenario:{...base.scenario,counterattackTick:50}};assert.match(expeditionObjective(s,player).title,/反扑5秒/);
 s.scenario.counterattackSpawned=true;s.enemies=[{id:'guardian-counterattack',roomId:'resource',hp:20}];assert.equal(expeditionObjective(s,player).roomId,'resource');
 assert.match(expeditionObjective({...base,result:{winner:'p1',reason:'完成编目'}},player).title,/远征胜利/);
});


test('result names rooms and buildings; material balance is inventory rather than cumulative deposits',()=>{
 const o=expeditionObjective({...base,actors:[{...actor,cargo:0}],events:[{playerId:'p1',message:'target catalog 扣除25建材，开始8秒施工'}]}, {...player,materials:9});
 assert.match(o.detail,/库存9材/);assert.match(o.detail,/书库 编目台 扣除25建材/);assert.doesNotMatch(o.detail,/catalog|target/);
});


test('published AI owns preparation without inventing unexecuted actor tasks',()=>{
 const s={...base,tick:0,paused:true,actors:[{...actor,task:null,cargo:0,travel:null}]};
 const published={...player,script:{sourceHash:'abcdef0123456789',entry:'main',publishedAtTick:0}};
 const o=expeditionObjective(s,published);
 assert.equal(o.title,'AI规则已接管 → 开始远征');
 assert.match(o.detail,/已发布 abcdef01 · 采撷师：等待AI首拍/);
 assert.doesNotMatch(o.detail,/待分工|采集运输|推荐分工/);
 const actual=expeditionObjective({...s,actors:[actor]},published);
 assert.match(actual.detail,/采撷师：采集运输/);
});

test('disabling published AI restores task preparation; preview alone does not publish',()=>{
 const s={...base,tick:0,paused:true,actors:[{...actor,task:null}]};
 assert.match(expeditionObjective(s,{...player,script:null}).title,/推荐分工/);
 assert.match(expeditionObjective(s,player).detail,/待分工/);
 assert.equal(expeditionObjective({...s,actors:[actor]},{...player,script:null}).title,'分工已就绪 → 开始远征');
});
