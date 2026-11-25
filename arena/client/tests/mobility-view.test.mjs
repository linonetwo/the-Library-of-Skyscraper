import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actorActivity} from '../src/actorActivity.ts';
import {runChoices,mobilityCommand} from '../src/mobilityChoices.ts';

const actor={id:'a',owner:'p',roomId:'source',hp:100,cargo:8,state:'moving',travel:{targetRoomId:'destination',segment:1,segmentElapsedMicros:250000,segments:[{durationMicros:2000000},{durationMicros:1000000},{durationMicros:500000}]}};
const world={rooms:[{id:'source',kind:'resource'},{id:'destination',kind:'resource',name:'前线书库'}],buildings:[]};
test('return wording requires an actual completed living owned warehouse, not a return task',()=>{
 const unit={...actor,task:{kind:'return',target:'destination'}};
 for(const building of [{owner:'enemy',hp:100,constructionTicks:8,requiredTicks:8},{owner:'p',hp:0,constructionTicks:8,requiredTicks:8},{owner:'p',hp:100,constructionTicks:3,requiredTicks:8}]){
  assert.equal(actorActivity(unit,{...world,buildings:[{roomId:'destination',kind:'warehouse',...building}]}).returning,false);
 }
 const active=actorActivity(unit,{...world,buildings:[{roomId:'destination',kind:'warehouse',owner:'p',hp:100,constructionTicks:8,requiredTicks:8}]});
 assert.equal(active.title,'携材返仓');assert.equal(active.etaSeconds,2);
});
test('run choices use ordinary topology and commands preserve via; endpoint shortcuts are excluded',()=>{
 const snapshot={worldMap:{links:[{from:'a',to:'b'},{from:'b',to:'c'},{from:'c',to:'d'},{from:'a',to:'d'}]}};
 assert.deepEqual(runChoices(snapshot,'a'),[{viaRoomId:'b',roomId:'c'},{viaRoomId:'d',roomId:'c'}]);
 assert.deepEqual(mobilityCommand(snapshot,{id:'actor',roomId:'a'},{kind:'run',viaRoomId:'b',roomId:'c'}),{type:'run',actorId:'actor',viaRoomId:'b',roomId:'c'});
 assert.equal(mobilityCommand(snapshot,{id:'actor',roomId:'a'},{kind:'run',viaRoomId:'c',roomId:'d'}),null);
});
