import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, travel } from '../examples/run.ts';
import { context, freeze } from './fixture.mjs';

test('run example uses exactly distance two, lowest intermediate, and walk for neighbors',()=>{
 const ctx=context({roomId:'room-1'});
 assert.deepEqual(decide(freeze(ctx)).intents,[{type:'run',actorId:'p1-gatherer',viaRoomId:'room-0',roomId:'room-4',priority:40}]);
 const near=context({roomId:'room-2'});
 assert.equal(travel(near,near.squad.actors[0],'room-1',10).type,'move');
 assert.equal(travel(near,near.squad.actors[0],'room-2',10),undefined);
 const reversed=context({roomId:'room-1'});reversed.world.rooms.reverse();
 assert.equal(decide(reversed).intents[0].viaRoomId,'room-0');
});
test('run example reads existing move plans without executing tasks or mutating the context',()=>{
 const ctx=context({roomId:'room-1'});
 ctx.tasks.items=[{id:'trip',actorId:'p1-gatherer',roomId:'room-5',kind:'move',priority:80,status:'running',blockedReason:null,source:'rule',sourceHash:'test',updatedAtTick:9}];
 assert.deepEqual(decide(freeze(ctx)).intents,[{type:'run',actorId:'p1-gatherer',viaRoomId:'room-0',roomId:'room-5',priority:80}]);
 assert.deepEqual(decide(context({hp:0})).intents,[]);
});
