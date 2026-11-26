import type { CustomModuleDefinition } from "../../../../behavior-modules/graph";
export function CustomModuleLibrary({ definitions, onNew, onEdit, onAdd, onRemove, onClose }: {
  definitions: CustomModuleDefinition[]; onNew: () => void; onEdit: (definition: CustomModuleDefinition) => void;
  onAdd: (definition: CustomModuleDefinition) => void; onRemove: (definition: CustomModuleDefinition) => void; onClose: () => void;
}) {
  return <section className="custom-module-library" aria-label="我的模块">
    <header><h3>我的模块</h3><button onClick={onClose}>返回编排</button></header>
    <button onClick={onNew}>新建自定义模块</button>
    {!definitions.length && <p>为模块命名、设计参数与出口，编写自己的行为 TypeScript。</p>}
    {definitions.map(definition => <article key={`${definition.definitionId}:${definition.revisionId}`}>
      <h4>{definition.name}</h4><p>版本 {definition.revisionId.slice(0, 12)} · {definition.fields.length} 个参数 · {definition.exits.length} 个命名出口</p>
      <p>{definition.fields.map(field => field.label).join(" · ")}</p>
      <div className="module-actions"><button aria-label={`添加自定义模块 ${definition.name} ${definition.revisionId.slice(0, 12)}`} onClick={() => onAdd(definition)}>预览添加实例</button>
        <button aria-label={`编辑模块本体 ${definition.name} ${definition.revisionId.slice(0, 12)}`} onClick={() => onEdit(definition)}>编辑本体并保存新版</button>
        <button aria-label={`移除收藏 ${definition.name} ${definition.revisionId.slice(0, 12)}`} onClick={() => onRemove(definition)}>移除收藏</button></div>
    </article>)}
  </section>;
}
