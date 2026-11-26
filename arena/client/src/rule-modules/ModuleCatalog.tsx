import { useRef, useState } from "react";
import { roleNames } from "../types";
import type { CustomModuleDefinition, RuleGraph } from "../../../behavior-modules/graph";
import { graphModuleName, moduleCatalog, moduleKinds, moduleTemplate, type ModuleRequest } from "./moduleCatalog";
import "./modules.css";
export function ModuleCatalog({ graph, onChoose, customDefinitions = [], onChooseCustom }: { graph: RuleGraph | null; onChoose: (request: ModuleRequest) => void; customDefinitions?: CustomModuleDefinition[]; onChooseCustom?: (definition: CustomModuleDefinition) => void }) {
  const [open, setOpen] = useState(false);
  const launch = useRef<HTMLButtonElement>(null);
  return <section className="module-catalog" aria-label="模块目录">
    <button ref={launch} aria-expanded={open} onClick={() => setOpen(!open)}>＋添加模块</button>
    {open && <div>
      <p>选择模块预览参数和回退；确认接入后写入当前草稿。执行岗位可在参数中选择。</p>
      <div className="module-catalog-items">{moduleKinds.map(kind => <article key={kind}>
        <h4>{moduleCatalog[kind].name}</h4><small>默认岗位：{(moduleTemplate(kind).roleFilter ?? ["gatherer", "guard", "scout"]).map(role => roleNames[role]).join(" / ")}</small><p>{moduleCatalog[kind].description}</p>
        <button aria-label={`选择模块 ${moduleCatalog[kind].name}`} onClick={() => { onChoose({ type: "new", module: moduleTemplate(kind) }); setOpen(false); }}>预览添加</button>
      </article>)}</div>
      {customDefinitions.length > 0 && <section aria-label="目录中的我的模块"><h4>我的模块</h4>{customDefinitions.map(definition => <article key={`${definition.definitionId}:${definition.revisionId}`}><h4>{definition.name}</h4><p>版本 {definition.revisionId.slice(0, 12)}</p><button aria-label={`选择自定义模块 ${definition.name} ${definition.revisionId.slice(0, 12)}`} onClick={() => { onChooseCustom?.(definition); setOpen(false); }}>预览添加实例</button></article>)}</section>}
      {graph && <label>引用已有实例<select aria-label="引用已有模块实例" value="" onChange={event => { if (event.target.value) { onChoose({ type: "existing", moduleId: event.target.value }); setOpen(false); } }}>
        <option value="">选择共享实例</option>{graph.modules.map(module => <option key={module.moduleId} value={module.moduleId}>{graphModuleName(graph, module)} · {module.moduleId} · {graph.nodes.filter(node => node.type === "module" && node.moduleId === module.moduleId).length} 个引用</option>)}
      </select></label>}
      <button onClick={() => { setOpen(false); launch.current?.focus(); }}>返回编排</button>
    </div>}
  </section>;
}
