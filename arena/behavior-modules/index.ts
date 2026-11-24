import type { BehaviorPlan, RuleSourceProject } from './types';
import { runtimeSource } from './runtime-source';
import { contractSource } from './contract-source';
export type * from './types';
export { createDefaultBehaviorPlan, createFirstExpeditionPlan } from './defaults';
const marker = '// @arena-ai/v1 ';
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}
export function toRuleSourceProject(plan: BehaviorPlan): RuleSourceProject {
  const json = canonical(plan);
  const { modules, ...header } = plan;
  const executable = canonical(header).slice(0,-1) + ',\n\"modules\":[\n' + modules.map(m=>canonical(m)).join(',\n') + '\n]}';
  return { entry: 'main.ts', files: {
    'main.ts': "export { decide } from './runtime';\n",
    'ai-plan.ts': marker + json + '\n' + contractSource + '\nexport const plan: BehaviorPlan = ' + executable + ';\n',
    'runtime.ts': runtimeSource,
  } };
}
/** Only exact generated projects are editable as modules. Manual code is never overwritten. */
export function recoverBehaviorPlan(project: RuleSourceProject): BehaviorPlan | null {
  const line = project.files['ai-plan.ts']?.split('\n')[0];
  if (!line?.startsWith(marker)) return null;
  try {
    const plan = JSON.parse(line.slice(marker.length)) as BehaviorPlan;
    if (plan.schemaVersion!==1 || plan.mode!=='priority' || plan.fallbackModuleId!=='hold' || !Array.isArray(plan.modules)) return null;
    const generated = toRuleSourceProject(plan);
    if ((project.entry??'main.ts')!==generated.entry || canonical(project.files)!==canonical(generated.files)) return null;
    return plan;
  } catch { return null; }
}

export function getModuleSourceRef(project: RuleSourceProject, moduleId: string): { file: string; line: number; column: number } | null {
  // Read archived configuration independently of the runtime version. Editing still
  // requires recoverBehaviorPlan's exact whole-project comparison.
  const line = project.files['ai-plan.ts']?.split('\n')[0];
  if (!line?.startsWith(marker)) return null;
  let plan: BehaviorPlan;
  try {
    plan = JSON.parse(line.slice(marker.length)) as BehaviorPlan;
    if (plan.schemaVersion!==1 || plan.mode!=='priority' || plan.fallbackModuleId!=='hold' || !Array.isArray(plan.modules)) return null;
    const source = project.files['ai-plan.ts'];
    const declaration = 'export const plan: BehaviorPlan = ';
    const start = source.indexOf(declaration);
    if (start < 0 || (project.entry??'main.ts')!=='main.ts' || project.files['main.ts']!=="export { decide } from './runtime';\n") return null;
    const executable = JSON.parse(source.slice(start+declaration.length).trim().replace(/;$/, ''));
    if (canonical(executable)!==canonical(plan)) return null;
    const lines = source.split('\n');
    const modulesLine = lines.findIndex(line=>line==='"modules":[');
    if (modulesLine<0 || plan.modules.some((module,index)=>lines[modulesLine+index+1]!==canonical(module)+(index<plan.modules.length-1?',':''))) return null;
  } catch { return null; }
  if (moduleId === 'hold') {
    const lines = project.files['runtime.ts']?.split('\n') ?? [];
    const index = lines.findIndex(line=>line.includes("moduleId:'hold'"));
    return index < 0 ? null : { file: 'runtime.ts', line: index+1, column: 1 };
  }
  const index = plan.modules.findIndex(module=>module.moduleId===moduleId);
  if (index<0) return null;
  const lines = project.files['ai-plan.ts'].split('\n');
  const start = lines.findIndex(line=>line==='"modules":[');
  return { file: 'ai-plan.ts', line: start+index+2, column: 1 };
}
