import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutDecisionNodes} from '../src/rule-graph/treeLayout.ts';
test('shared-leaf decisions run left to right without another branch occupying their connection corridor',()=>{
 const nodes=['condition','gather','haul','hold'].map(id=>({id}));
 const edges=[{from:'condition',to:'haul'},{from:'condition',to:'gather'},{from:'haul',to:'hold'},{from:'gather',to:'hold'}];
 const p=layoutDecisionNodes(nodes,edges);
 for(const {from,to} of edges)assert(p.get(from).x+170<p.get(to).x);
 assert(p.get('haul').y<p.get('gather').y);
 assert.equal(p.get('haul').x,p.get('gather').x);
 assert.deepEqual(layoutDecisionNodes(nodes,edges),p);
});
test('incomplete and cyclic drafts remain finite and visible rather than blocking layout',()=>{
 const nodes=['cycle','leaf'].map(id=>({id}));
 const p=layoutDecisionNodes(nodes,[{from:'cycle',to:'cycle'},{from:'leaf',to:''}]);
 assert.equal(p.size,2);for(const pos of p.values())assert(Number.isFinite(pos.x)&&Number.isFinite(pos.y));
});
