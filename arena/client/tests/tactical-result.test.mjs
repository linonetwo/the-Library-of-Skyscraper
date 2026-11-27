import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {tacticalResultModel} from '../src/tacticalResultModel.ts';
import {actorActivity,stateName} from '../src/actorActivity.ts';
// Public settlement fields read back from root's completed online-full T202 session.
const captured=JSON.parse(await readFile(new URL('./fixtures/seal-contest-settlement.json',import.meta.url),'utf8'));
const snapshot={...captured,scenarioId:'seal-contest',tickDurationMs:500};
test('real 20:4 settlement keeps winner, score order, own marker, reason and 1:41 game time',()=>{
 const winner=tacticalResultModel(snapshot,'p2');
 assert.equal(winner.heading,'据点争夺胜利');assert.equal(winner.winnerLabel,'p2（本人）');
 assert.deepEqual(winner.players.map(p=>[p.id,p.score,p.own,p.winner]),[['p2',20,true,true],['p1',4,false,false]]);
 assert.equal(winner.reason,captured.result.reason);assert.equal(winner.duration,'1:41');assert.equal(winner.scoreGoal,20);
 const loser=tacticalResultModel(snapshot,'p1');assert.equal(loser.heading,'据点争夺失利');
 assert.equal(loser.winnerLabel,'p2');assert.equal(loser.players[1].own,true);
});
test('draw and timed settlement follow authority result rather than claiming the score goal was reached',()=>{
 const players=[{id:'p1',name:'甲方书库',score:12},{id:'p2',name:'乙方书库',score:12}];
 const draw=tacticalResultModel({...snapshot,players,result:{winner:'',reason:'演练限时结束，同分平局'}},'p1');
 assert.equal(draw.heading,'据点争夺 · 平局');assert.equal(draw.winnerLabel,'平局');assert.ok(draw.players.every(p=>!p.winner));
 const timed=tacticalResultModel({...snapshot,players:[players[0],{...players[1],score:4}],scenarioConfig:{exclusiveScoreTicks:24},result:{winner:'p1',reason:'演练限时结束，比分领先'}},'p1');
 assert.equal(timed.winnerLabel,'甲方书库（本人）');assert.equal(timed.reason,'演练限时结束，比分领先');assert.equal(timed.scoreGoal,24);
 assert.equal(tacticalResultModel({...snapshot,result:null},'p1'),undefined);
});
test('actual tactical states are Chinese in activity titles and task or untasked details',()=>{
 const world={rooms:[{id:'room-2',name:'争夺书印'}],buildings:[]};
 const actor={hp:30,owner:'p1',roomId:'room-2',cargo:0};
 for(const [state,name]of Object.entries({claiming:'占领据点',repairing:'修复设施',casting:'蓄咏墨印','cast-recovery':'施法收势',rising:'正在起身'})){
  assert.equal(stateName(state),name);
  const active=actorActivity({...actor,state},world);assert.equal(active.title,name);assert.equal(active.detail,name);
 }
 assert.equal(actorActivity({...actor,state:'claiming',task:{kind:'claim',target:'room-2',stage:'claiming'}},world).detail,'争夺书印 · 占领据点');
 assert.equal(stateName('gathering'),'采集藏材');
});
