import { useMemo, useRef, useState } from "react";
import { exportGraphFragment, graphFragmentRefs, importGraphFragment, type RuleGraph, type GraphPatch, type GraphFragmentBindings } from "../../../behavior-modules/graph";
import { roleNames } from "../types";
import { GraphRoomSelect } from "../rule-graph/GraphRoomSelect";
import type { GraphSelection } from "../rule-graph/graphObjects";
import { readFragments, writeFragments, type SavedGraphFragment } from "./fragmentStore";
import "./fragments.css";

export function GraphFragmentLibrary({ graph, selection, onApply, onSelect }: {
  graph: RuleGraph; selection: GraphSelection | null;
  onApply: (patch: GraphPatch) => void; onSelect: (selection: GraphSelection) => void;
}) {
  const [saved, setSaved] = useState(readFragments);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<SavedGraphFragment | null>(null);
  const [bindings, setBindings] = useState<GraphFragmentBindings>({ rooms: {}, ownRoles: {} });
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const library = useRef<HTMLDetailsElement>(null);
  const capture = useMemo(() => {
    if (selection?.kind !== "nodes") return null;
    try { return { fragment: exportGraphFragment(graph, selection.id), error: "" }; }
    catch (cause) { return { fragment: null, error: (cause as Error).message }; }
  }, [graph, selection]);
  const refs = selected ? graphFragmentRefs(selected.fragment) : [];
  const ready = selected && target && refs.every(ref => ref.type === "room" ? bindings.rooms[ref.roomId] : bindings.ownRoles[ref.role]);
  const persist = (next: SavedGraphFragment[]) => { writeFragments(next); setSaved(next); };
  const preview = (item: SavedGraphFragment) => {
    setSelected(item); setBindings({ rooms: {}, ownRoles: {} });
    setTarget(selection?.kind === "states" ? selection.id : ""); setError("");
  };
  const insert = () => {
    if (!selected || !ready) return;
    try {
      const result = importGraphFragment(graph, selected.fragment, bindings);
      const state = graph.states.find(state => state.id === target)!;
      onApply({ ...result.patch, operations: [...result.patch.operations, { type: "putState", state: { ...state, treeId: result.rootId } }] });
      onSelect({ kind: "states", id: target }); onSelect({ kind: "nodes", id: result.rootId }); setSelected(null); setError("");
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-object-kind="nodes"][data-object-id="${CSS.escape(result.rootId)}"]`)?.focus());
    } catch (cause) { setError((cause as Error).message); }
  };
  return <details ref={library} className="graph-fragments" data-fragment-state={JSON.stringify({ saved, selected, bindings, targetStateId: target, ready: Boolean(ready), error })}>
    <summary>个人决策片段 · {saved.length}</summary>
    <section aria-label="保存决策片段">
      <p>选择决策节点，保存其子树及依赖的模块实例。</p>
      {capture?.fragment && <p>根节点 {capture.fragment.rootId} · {capture.fragment.nodes.length} 个节点 · {capture.fragment.modules.length} 个实例；共享引用保留。</p>}
      {capture?.fragment && <details><summary>查看保存范围</summary><p>节点：{capture.fragment.nodes.map(node => node.id).join("、")}</p><p>依赖实例：{capture.fragment.modules.map(module => module.moduleId).join("、") || "无"}</p></details>}
      {capture?.error && <p role="alert">{capture.error}</p>}
      <label>片段名称<input aria-label="片段名称" value={name} onChange={event => setName(event.target.value)} /></label>
      <button disabled={!name.trim() || !capture?.fragment} onClick={() => {
        persist([...saved, { id: crypto.randomUUID(), name: name.trim(), fragment: capture!.fragment! }]); setName("");
      }}>保存所选子树</button>
    </section>
    <ul>{saved.map(item => <li key={item.id}><strong>{item.name}</strong><span>{item.fragment.nodes.length} 节点 / {item.fragment.modules.length} 实例</span>
      <button data-fragment-id={item.id} onClick={() => preview(item)} aria-label={`预览插入 ${item.name}`}>预览插入</button>
      <button onClick={() => { persist(saved.filter(fragment => fragment.id !== item.id)); if (selected?.id === item.id) setSelected(null); }} aria-label={`删除片段 ${item.name}`}>删除收藏</button>
    </li>)}</ul>
    {selected && <section aria-label="片段插入预览">
      <h4>插入「{selected.name}」</h4>
      <p>节点与实例使用新 ID；片段内部共享同一实例。确认后一次插入，可用「撤销图修改」整体撤回。</p>
      <label>替换状态的持续树<select aria-label="片段插入状态" value={target} onChange={event => setTarget(event.target.value)}><option value="">选择插入状态</option>{graph.states.map(state => <option key={state.id} value={state.id}>{state.name} · {state.id}</option>)}</select></label>
      <p>当前入口：{graph.states.find(state => state.id === target)?.treeId} → 片段根：{selected.fragment.rootId}（插入时分配新 ID）</p>
      {refs.map(ref => ref.type === "room" ? <GraphRoomSelect key={`room:${ref.roomId}`} label={`原房间 ${ref.roomId} → 目标房间`} value={bindings.rooms[ref.roomId] ?? ""} onChange={room => setBindings({ ...bindings, rooms: { ...bindings.rooms, [ref.roomId]: room } })} /> : <label key={`role:${ref.role}`}>原岗位 {roleNames[ref.role]} · {ref.role} → 目标岗位<select aria-label={`岗位绑定 ${ref.role}`} value={bindings.ownRoles[ref.role] ?? ""} onChange={event => setBindings({ ...bindings, ownRoles: { ...bindings.ownRoles, [ref.role]: event.target.value as typeof ref.role } })}><option value="">选择岗位</option>{Object.entries(roleNames).map(([role, label]) => <option key={role} value={role}>{label} · {role}</option>)}</select></label>)}
      <p>房间绑定：{Object.entries(bindings.rooms).map(([from, to]) => `${from} → ${to}`).join("；") || "选择对应房间"}；岗位绑定：{Object.entries(bindings.ownRoles).map(([from, to]) => `${from} → ${to}`).join("；") || "按片段引用选择"}</p>
      <button disabled={!ready} onClick={insert}>确认插入并连接</button><button onClick={() => { setSelected(null); library.current?.querySelector<HTMLButtonElement>(`[data-fragment-id="${selected.id}"]`)?.focus(); }}>返回片段列表</button>
    </section>}
    {error && <p role="alert">{error}</p>}
  </details>;
}
