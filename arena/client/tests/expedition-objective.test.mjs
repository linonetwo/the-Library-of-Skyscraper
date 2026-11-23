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
