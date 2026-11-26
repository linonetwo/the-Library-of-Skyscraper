import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {build} from '../../script-toolchain/node_modules/esbuild/lib/main.js';
const built=await build({entryPoints:[new URL('./index.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
test('historical declarations are readable without granting current-generator recovery',()=>{
 const graph=api.createCompositionGraph(),project=api.toGraphSourceProject(graph);project.files['composition-runtime.ts']+='\n// historical helper version\n';
 assert.equal(api.recoverRuleGraph(project),null);assert.deepEqual(api.readArchivedRuleGraph(project),graph);assert.ok(api.getGraphSourceRef(project,'escort-cargo'));
 const old=JSON.parse(readFileSync(new URL('./fixtures/v050-shortcut-project.json',import.meta.url)));assert.deepEqual(api.readArchivedRuleGraph(old),api.createShortcutSupportGraph());
});
test('archive reader requires matching actual JSON declaration and marker',()=>{
 const graph=api.createCompositionGraph(),project=api.toGraphSourceProject(graph);
 const mismatch=structuredClone(project);const lines=mismatch.files['graph-plan.ts'].split('\n');const marker=JSON.parse(lines[0].slice('// @arena-graph/v2 '.length));marker.revision++;lines[0]='// @arena-graph/v2 '+JSON.stringify(marker);mismatch.files['graph-plan.ts']=lines.join('\n');assert.equal(api.readArchivedRuleGraph(mismatch),null);assert.equal(api.getGraphSourceRef(mismatch,'escort-cargo'),null);
 const executable=structuredClone(project);executable.files['graph-plan.ts']=executable.files['graph-plan.ts'].replace('export const graph:RuleGraph = {','export const graph:RuleGraph = (()=>({');assert.equal(api.readArchivedRuleGraph(executable),null);
 assert.equal(api.readArchivedRuleGraph({files:{'main.ts':'export function decide(){return {intents:[]}}'}}),null);
});
