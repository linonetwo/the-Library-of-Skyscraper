import type {RuleSourceProject} from '../types';
import type {RuleGraph,GraphSourceRef} from './types';
import {toGraphSourceProject} from './project';
/** Explicit graph-to-source handover. The UI preserves its prior draft in replacement history. */
export function createInkStrikeSourceProject(graph:RuleGraph):{project:RuleSourceProject;activeFile:string} {
 const project=toGraphSourceProject(graph),activeFile='skills/ink-strike.ts';
 return {activeFile,project:{...project,files:{...project.files,
  [project.entry??'main.ts']:project.files[project.entry??'main.ts']+"export {chantInkStrike} from './skills/ink-strike';\n",
  [activeFile]:`import type {ChantInput,ChantApi} from '@skyscraper/arena-script-sdk';
/** Editable starter; this authored TS is archived under its actual rule bundle version. */
export function chantInkStrike(input:ChantInput,api:ChantApi):void {
 api.seal(api.channel(api.observe()));
}
`}}};
}
/** Authored source only; official source is read from its recorded skill version archive. */
export function getInkStrikeSourceRef(project:RuleSourceProject):GraphSourceRef|null {
 const entry=project.files[project.entry??'main.ts'];
 if(!entry?.split('\n').some(line=>line==="export {chantInkStrike} from './skills/ink-strike';"))return null;
 const file='skills/ink-strike.ts',source=project.files[file];if(!source)return null;
 const line=source.split('\n').findIndex(line=>/^export (function|const) chantInkStrike\b/.test(line));
 return line<0?null:{file,line:line+1,column:1};
}
