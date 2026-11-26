import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registeredAnchorPoint,timedPhaseFrame} from '../src/registeredAnchors.ts';
test('trim-independent anchors preserve the same world foot across cast and recover canvases',()=>{
 const foot={x:-512,y:-192};
 assert.deepEqual(registeredAnchorPoint(foot,[110,120],[96,172.8],1),registeredAnchorPoint(foot,[142,152],[128,204.8],1));
 assert.deepEqual(registeredAnchorPoint(foot,[128,204.8],[128,204.8],1),foot);
});
test('chant/release/recovery ranges use one simulation clock and exclusive boundaries',()=>{
 const range={first:3,last:4};
 assert.equal(timedPhaseFrame(10999,22,23,500,range),undefined);
 assert.equal(timedPhaseFrame(11000,22,23,500,range),3);
 assert.equal(timedPhaseFrame(11250,22,23,500,range),4);
 assert.equal(timedPhaseFrame(11500,22,23,500,range),undefined);
 assert.equal(timedPhaseFrame(11000,23,22,500,range),undefined);
});
