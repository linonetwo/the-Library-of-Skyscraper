import { useState } from "react";
import { diagnoseCustomModule, previewCustomModuleUpgrade, upgradeCustomModule, type CustomModuleBinding, type CustomModuleDefinition, type GraphPatch, type RuleGraph } from "../../../../behavior-modules/graph";
import { CustomParameterInput } from "./CustomParameterInput";
export function CustomModuleUpgrade({ graph, module, definitions, onApply, onEditBody }: {
  graph: RuleGraph; module: CustomModuleBinding; definitions: CustomModuleDefinition[];
  onApply: (patch: GraphPatch) => void; onEditBody: (definition: CustomModuleDefinition) => void;
}) {
  const [revision, setRevision] = useState("");
  const [config, setConfig] = useState<CustomModuleBinding["config"]>({});
  const current = graph.customDefinitions?.find(item => item.definitionId === module.definitionId && item.revisionId === module.revisionId);
  const versions = definitions.filter(item => item.definitionId === module.definitionId && item.revisionId !== module.revisionId);
  const selected = versions.find(item => item.revisionId === revision);
  const preview = selected ? previewCustomModuleUpgrade(graph, module.moduleId, selected) : null;
  const patch = selected ? upgradeCustomModule(graph, module.moduleId, selected) : null;
  const binding = patch?.operations.find(operation => operation.type === "putModule")?.module;
  const next = binding?.kind === "custom" ? { ...binding, config: { ...binding.config, ...config } } : null;
  const diagnostics = selected && next ? diagnoseCustomModule(selected, next.config) : [];
  return <section className="custom-module-upgrade" aria-label="模块本体版本">
    <h4>实例 {module.moduleId} · 本体 {current?.name ?? module.definitionId}</h4>
    <p>当前锁定版本 {module.revisionId.slice(0, 12)}</p>
    {current && <button onClick={() => onEditBody(current)}>编辑此模块本体</button>}
    <label>可升级版本<select aria-label="模块升级版本" value={selected?.revisionId ?? ""} onChange={event => { setRevision(event.target.value); setConfig({}); }}><option value="">选择我的模块版本</option>{versions.map(item => <option key={item.revisionId} value={item.revisionId}>{item.name} · {item.revisionId.slice(0, 12)}</option>)}</select></label>
    {selected && preview && next && patch && <>
      <p>移除参数：{preview.removedFields.join("、") || "无"}；移除出口：{preview.removedExits.join("、") || "无"}。</p>
      <p>受影响引用：{preview.affectedNodeIds.join("、")}。已移除出口的连线回到各叶原后备。</p>
      {selected.fields.map(field => <CustomParameterInput key={field.key} field={field} value={next.config[field.key]} onChange={value => setConfig({ ...config, [field.key]: value })} />)}
      {diagnostics.map((item, index) => <p role="alert" key={index}>参数 {item.key} 须符合该版类型和范围。</p>)}
      <button disabled={!!diagnostics.length} onClick={() => { onApply({ ...patch, operations: patch.operations.map(operation => operation.type === "putModule" ? { ...operation, module: next } : operation) }); setRevision(""); setConfig({}); }}>将此实例升级至所选版本</button>
      <button onClick={() => { setRevision(""); setConfig({}); }}>返回当前版本</button>
    </>}
  </section>;
}
