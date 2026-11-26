import type { CustomField, CustomModuleDraft } from "../../../../behavior-modules/graph";
import { CustomParameterInput } from "./CustomParameterInput";

const fieldTypes: Record<CustomField["type"], string> = { number: "数值", boolean: "开关", roomRef: "房间", ownRoleRef: "本队岗位" };
function changeType(field: CustomField, type: CustomField["type"]): CustomField {
  const base = { key: field.key, label: field.label };
  switch (type) {
    case "number": return { ...base, type, default: 0 };
    case "boolean": return { ...base, type, default: false };
    case "roomRef": return { ...base, type, default: { type: "room", roomId: "" } };
    case "ownRoleRef": return { ...base, type, default: { type: "ownRole", role: "gatherer" } };
  }
}
export function DefinitionShapeFields({ draft, onChange }: { draft: CustomModuleDraft; onChange: (draft: CustomModuleDraft) => void }) {
  const updateField = (index: number, field: CustomField) => onChange({ ...draft, fields: draft.fields.map((value, i) => i === index ? field : value) });
  return <>
    <fieldset className="custom-parameters"><legend>模块参数</legend>
      {draft.fields.map((field, index) => <fieldset className="custom-parameter-row" key={index}><legend>参数 {index + 1}</legend>
        <label>参数键<input aria-label={`参数 ${index + 1} 键`} value={field.key} onChange={event => updateField(index, { ...field, key: event.target.value })} /></label>
        <label>显示名<input aria-label={`参数 ${index + 1} 显示名`} value={field.label} onChange={event => updateField(index, { ...field, label: event.target.value })} /></label>
        <label>类型<select aria-label={`参数 ${index + 1} 类型`} value={field.type} onChange={event => updateField(index, changeType(field, event.target.value as CustomField["type"]))}>{Object.entries(fieldTypes).map(([type, name]) => <option key={type} value={type}>{name}</option>)}</select></label>
        <CustomParameterInput field={field} value={field.default} label={`参数 ${index + 1} 默认值`} onChange={value => updateField(index, { ...field, default: value } as CustomField)} />
        {field.type === "number" && <>
          <label className="custom-check"><input type="checkbox" aria-label={`参数 ${index + 1} 仅整数`} checked={field.integer ?? false} onChange={event => updateField(index, { ...field, integer: event.target.checked })} />仅整数</label>
          <label>下限<input aria-label={`参数 ${index + 1} 下限`} type="number" value={field.min ?? ""} onChange={event => updateField(index, { ...field, min: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
          <label>上限<input aria-label={`参数 ${index + 1} 上限`} type="number" value={field.max ?? ""} onChange={event => updateField(index, { ...field, max: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
        </>}
        <button onClick={() => onChange({ ...draft, fields: draft.fields.filter((_, i) => i !== index) })}>删除参数 {index + 1}</button>
      </fieldset>)}
      <button onClick={() => onChange({ ...draft, fields: [...draft.fields, { key: `parameter${draft.fields.length + 1}`, label: "新参数", type: "number", default: 0 }] })}>添加参数</button>
    </fieldset>
    <fieldset className="custom-ports"><legend>命名出口</legend><p>提议动作、保持与后备为固定结果；这里添加可连线的分支。</p>
      {draft.exits.map((exit, index) => <div className="custom-exit-row" key={index}>
        <label>出口键<input aria-label={`出口 ${index + 1} 键`} value={exit.key} onChange={event => onChange({ ...draft, exits: draft.exits.map((value, i) => i === index ? { ...exit, key: event.target.value } : value) })} /></label>
        <label>出口显示名<input aria-label={`出口 ${index + 1} 显示名`} value={exit.label} onChange={event => onChange({ ...draft, exits: draft.exits.map((value, i) => i === index ? { ...exit, label: event.target.value } : value) })} /></label>
        <button onClick={() => onChange({ ...draft, exits: draft.exits.filter((_, i) => i !== index) })}>删除出口 {index + 1}</button>
      </div>)}
      <button onClick={() => onChange({ ...draft, exits: [...draft.exits, { key: `branch${draft.exits.length + 1}`, label: "新分支" }] })}>添加命名出口</button>
    </fieldset>
  </>;
}
