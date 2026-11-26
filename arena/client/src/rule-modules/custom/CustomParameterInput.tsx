import type { CustomField, CustomModuleBinding } from "../../../../behavior-modules/graph";
import { GraphRoomSelect } from "../../rule-graph/GraphRoomSelect";
import { roleNames } from "../../types";

type Value = CustomModuleBinding["config"][string];
export function CustomParameterInput({ field, value, label = field.label, onChange }: {
  field: CustomField; value: Value; label?: string; onChange: (value: Value) => void;
}) {
  if (field.type === "number") return <label>{label}<input aria-label={label} type="number" value={typeof value === "number" ? value : ""} min={field.min} max={field.max} step={field.integer ? 1 : "any"} onChange={event => onChange(Number(event.target.value))} /></label>;
  if (field.type === "boolean") return <label className="custom-check"><input aria-label={label} type="checkbox" checked={value === true} onChange={event => onChange(event.target.checked)} />{label}</label>;
  if (field.type === "roomRef") return <GraphRoomSelect label={label} value={typeof value === "object" && value.type === "room" ? value.roomId : ""} onChange={roomId => onChange({ type: "room", roomId })} />;
  return <label>{label}<select aria-label={label} value={typeof value === "object" && value.type === "ownRole" ? value.role : ""} onChange={event => onChange({ type: "ownRole", role: event.target.value as keyof typeof roleNames })}><option value="">选择本队岗位</option>{Object.entries(roleNames).map(([role, name]) => <option key={role} value={role}>{name}</option>)}</select></label>;
}
