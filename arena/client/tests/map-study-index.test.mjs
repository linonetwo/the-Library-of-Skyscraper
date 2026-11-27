import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapStudyIndex} from '../src/mapStudyIndex.ts';
test('two-action workshop study overrides map actions while preserving normal idle/walk fallbacks',()=>{
 const entry=(action,root)=>({action,root,descriptor:'atlas-budget.json'});
 const main={assetSetId:'normal',clips:[entry('idle','/base/idle'),entry('walk','/base/walk'),entry('cast','/old/cast')]};
 const study={assetSetId:'combat-study',clips:[entry('cast','/study/cast'),entry('recover','/study/recover')]};
 const combined=mapStudyIndex(main,study),byAction=Object.fromEntries(combined.clips.map(clip=>[clip.action,clip]));
 assert.equal(byAction.idle,main.clips[0]);assert.equal(byAction.walk,main.clips[1]);
 assert.equal(byAction.cast,study.clips[0]);assert.equal(byAction.recover,study.clips[1]);
 assert.equal(combined.clips.length,4);assert.notEqual(combined.assetSetId,main.assetSetId);assert.notEqual(combined.assetSetId,study.assetSetId);
 assert.equal(main.clips.length,3);assert.equal(study.clips.length,2);
});
