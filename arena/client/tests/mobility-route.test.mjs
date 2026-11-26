import {test} from 'node:test';
import assert from 'node:assert/strict';
import {segmentPath} from '../src/mobilityRoute.ts';

const point = (y,z) => ({x:-7000,y,z});
const segments = [
  {role:'ladder',from:point(1000,0),to:point(1000,1500)},
  {role:'transfer',from:point(1000,1500),to:point(1500,1500)},
  {role:'traverse',from:point(1500,1500),to:point(5500,1500)},
  {role:'transfer',from:point(5500,1500),to:point(6000,1500)},
  {role:'ladder',from:point(6000,1500),to:point(6000,0)},
];
for (const reverse of [false,true]) test(`route leaves both ladder faces clear (${reverse?'reverse':'forward'})`,()=>{
  const commands=[];
  const line={moveTo(x,y){commands.push(['move',x,y]);return this;},lineTo(x,y){commands.push(['line',x,y]);return this;}};
  segmentPath(line,segments,reverse);
  assert.equal(commands.filter(c=>c[0]==='move').length,3);
  assert.equal(commands.filter(c=>c[0]==='line').length,36);
  // All strokes remain on the real elevated transfer/traverse plane, never down a ladder.
  for(const [,x,y] of commands) assert.ok(Math.abs(y-((-14-x/64)*32-1.5*78.384))<1e-8);
  assert.deepEqual(commands[0].slice(1), reverse?[-832,-149.576]:[-512,-309.576]);
});
