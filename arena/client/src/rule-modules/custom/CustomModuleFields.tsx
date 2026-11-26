import type { CustomModuleBinding, RuleGraph } from "../../../../behavior-modules/graph";
import { roleNames } from "../../types";
import { CustomParameterInput } from "./CustomParameterInput";
export function CustomModuleFields({ graph, module, onChange }: { graph: RuleGraph; module: CustomModuleBinding; onChange: (module: CustomModuleBinding) => void }) {
  const definition = graph.customDefinitions?.find(item => item.definitionId === module.definitionId && item.revisionId === module.revisionId);
  return <fieldset className="custom-module-fields"><legend>{definition?.name ?? "自定义模块"} · {module.moduleId}</legend>
    <p>本体版本 {module.revisionId.slice(0, 12)}</p>
    <label className="custom-check"><input type="checkbox" checked={module.enabled} onChange={event => onChange({ ...module, enabled: event.target.checked })} />启用模块</label>
    <label>优先级<input aria-label="模块优先级" type="number" value={module.priority} onChange={event => onChange({ ...module, priority: Number(event.target.value) })} /></label>
    <fieldset><legend>执行岗位</legend>{Object.entries(roleNames).map(([role, name]) => <label className="custom-check" key={role}><input type="checkbox" checked={!module.roleFilter || module.roleFilter.includes(role as keyof typeof roleNames)} onChange={event => {
      const current = module.roleFilter ?? Object.keys(roleNames) as (keyof typeof roleNames)[];
      onChange({ ...module, roleFilter: event.target.checked ? [...current, role as keyof typeof roleNames] : current.filter(value => value !== role) });
    }} />{name}</label>)}</fieldset>
    {definition ? definition.fields.map(field => <CustomParameterInput key={field.key} field={field} value={module.config[field.key]} onChange={value => onChange({ ...module, config: { ...module.config, [field.key]: value } })} />) : <p role="alert">当前图缺少这个版本的模块本体，请在定义诊断中查看。</p>}
  </fieldset>;
}
