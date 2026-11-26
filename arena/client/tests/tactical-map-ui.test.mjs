import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tacticalSelectionKey} from '../src/tacticalTargets.ts';
import {tacticalObjective} from '../src/tacticalObjective.ts';
test('stable target selection is scoped to session, actor and action',()=>{
 const key=tacticalSelectionKey('s','p1-guard','attack','enemy-b');
 for(const args of [['new','p1-guard','attack','enemy-b'],['s','p1-scout','attack','enemy-b'],['s','p1-guard','cast','enemy-b'],['s','p1-guard','attack','enemy-a']])assert.notEqual(tacticalSelectionKey(...args),key);
});
test('top objective reports real control ownership and progress, legacy stays on existing helper',()=>{
 const s={scenarioId:'seal-contest',phase:'running',rooms:[{id:'r',name:'星砂编目台',owner:'p2'}],players:[{name:'访客',score:20}],tactics:{controlPoints:[{roomId:'r',progressTicks:2,requiredTicks:6,contested:true}]}};
 assert.equal(tacticalObjective(s,'p1').title,'争夺 · 星砂编目台');
 assert.match(tacticalObjective(s,'p1').detail,/2\/6 · 正在争夺/);
 s.rooms[0].owner='p1';assert.equal(tacticalObjective(s,'p1').title,'守住 · 星砂编目台');
 assert.equal(tacticalObjective({...s,scenarioId:undefined},'p1'),undefined);
});
