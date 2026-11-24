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
  const plan = recoverBehaviorPlan(project);
  if (!plan) return null;
  if (moduleId === 'hold') {
    const lines = project.files['runtime.ts'].split('\n');
    return { file: 'runtime.ts', line: lines.findIndex(line=>line.includes("moduleId:'hold'"))+1, column: 1 };
  }
  const index = plan.modules.findIndex(module=>module.moduleId===moduleId);
  if (index<0) return null;
  const lines = project.files['ai-plan.ts'].split('\n');
  const start = lines.findIndex(line=>line==='"modules":[');
  return { file: 'ai-plan.ts', line: start+index+2, column: 1 };
}
