import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tacticalTargets,tacticalCommand} from '../src/tacticalTargets.ts';
const building={id:'own',kind:'warehouse',owner:'p1',roomId:'r',hp:60,maxHp:100,constructionTicks:8,requiredTicks:8};
const snapshot={rooms:[{id:'r',name:'前线',kind:'resource'}],enemies:[{id:'dead',hp:0},{id:'live',hp:8,maxHp:80,roomId:'r'}],buildings:[building,{...building,id:'enemy',owner:'p2'},{...building,id:'broken',hp:0},{...building,id:'full',hp:100},{...building,id:'unfinished',constructionTicks:1}],scenarioConfig:{controlPoints:[{roomId:'r'},{roomId:'missing'}]}};
test('targets come from living enemies, completed damaged owned buildings and real control points',()=>{
 assert.deepEqual(tacticalTargets(snapshot,'p1','attack').map(t=>t.id),['live']);
 assert.deepEqual(tacticalTargets(snapshot,'p1','repair').map(t=>t.id),['own']);
 assert.deepEqual(tacticalTargets(snapshot,'p1','claim').map(t=>t.id),['r']);
});
test('commands resolve exact IDs and contain no simulation or proof fields',()=>{
 assert.deepEqual(tacticalCommand('repair','actor','own'),{type:'repair',actorId:'actor',buildingId:'own'});
 assert.deepEqual(tacticalCommand('claim','actor','r'),{type:'claim',actorId:'actor',roomId:'r'});
 assert.deepEqual(tacticalCommand('cast','actor','live'),{type:'cast',actorId:'actor',targetId:'live',skillId:'ink-strike'});
});
