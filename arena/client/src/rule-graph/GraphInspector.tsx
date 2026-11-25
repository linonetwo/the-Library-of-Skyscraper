import { useState } from "react";
import type {
  RuleGraph,
  RuleNode,
  GraphOperation,
  GraphRole,
} from "../../../behavior-modules/graph";
import { ConditionFields, defaultCondition } from "./ConditionFields";
import { EffectFields } from "./EffectFields";
import { BehaviorModuleCard } from "../BehaviorModuleCard";
import { roleNames } from "../types";
import { nodeNames, putObject, type GraphSelection } from "./graphObjects";
function Reference({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: { id: string; name?: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">断开 · 待连接</option>
        {value && !items.some((item) => item.id === value) && (
          <option value={value}>{value} · 引用缺失</option>
        )}
        {items.map((item) => (
          <option value={item.id} key={item.id}>
            {item.name ?? item.id}
          </option>
        ))}
      </select>
    </label>
  );
}
export function GraphInspector({
  graph,
  selection,
  onEdit,
  onLocate,
}: {
  graph: RuleGraph;
  selection: GraphSelection;
  onEdit: (operations: GraphOperation[]) => void;
  onLocate: (id: string) => void;
}) {
  const [moduleExpanded, setModuleExpanded] = useState(true);
  const save = (value: Parameters<typeof putObject>[1]) =>
    onEdit([putObject(selection.kind, value)]);
  const nodeRef = (
    label: string,
    value: string,
    onChange: (id: string) => void,
  ) => (
    <Reference
      label={label}
      value={value}
      items={graph.nodes.map((n) => ({
        id: n.id,
        name: `${nodeNames[n.type]} · ${n.id}`,
      }))}
      onChange={onChange}
    />
  );
  const stateRef = (
    label: string,
    value: string,
    onChange: (id: string) => void,
  ) => (
    <Reference
      label={label}
      value={value}
      items={graph.states}
      onChange={onChange}
    />
  );
  let body;
  if (selection.kind === "nodes") {
    const node = graph.nodes.find((n) => n.id === selection.id);
    if (!node) return null;
    const update = (next: RuleNode) => save(next);
    body = (
      <>
        <h4>{nodeNames[node.type]}</h4>
        {(node.type === "condition" || node.type === "check") && (
          <ConditionFields
            value={node.condition}
            onChange={(condition) => update({ ...node, condition })}
          />
        )}
        {node.type === "condition" && (
          <>
            {nodeRef("满足时", node.yes, (yes) => update({ ...node, yes }))}
            {nodeRef("不满足时", node.no, (no) => update({ ...node, no }))}
          </>
        )}
        {(node.type === "priority" || node.type === "sequence") && (
          <fieldset>
            <legend>稳定尝试顺序</legend>
            {node.children.map((child, i) => (
              <div className="graph-child" key={i}>
                {nodeRef(`分支 ${i + 1}`, child, (id) =>
                  update({
                    ...node,
                    children: node.children.map((c, index) =>
                      i === index ? id : c,
                    ),
                  }),
                )}
                <button
                  disabled={i === 0}
                  onClick={() => {
                    const children = [...node.children];
                    [children[i - 1], children[i]] = [
                      children[i],
                      children[i - 1],
                    ];
                    update({ ...node, children });
                  }}
                >
                  上移分支 {i + 1}
                </button>
                <button
                  onClick={() =>
                    update({
                      ...node,
                      children: node.children.filter((_, index) => index !== i),
                    })
                  }
                >
                  移除分支 {i + 1}
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                update({ ...node, children: [...node.children, ""] })
              }
            >
              添加分支
            </button>
          </fieldset>
        )}
        {node.type === "score" && (
          <fieldset>
            <legend>候选评分 · 同分按此顺序</legend>
            {node.candidates.map((candidate, i) => (
              <fieldset key={candidate.id}>
                <legend>{candidate.id}</legend>
                {nodeRef(`候选 ${i + 1}`, candidate.nodeId, (nodeId) =>
                  update({
                    ...node,
                    candidates: node.candidates.map((c, index) =>
                      i === index ? { ...c, nodeId } : c,
                    ),
                  }),
                )}
                <label>
                  权重
                  <input
                    type="number"
                    value={candidate.weight}
                    onChange={(e) =>
                      update({
                        ...node,
                        candidates: node.candidates.map((c, index) =>
                          i === index
                            ? { ...c, weight: Number(e.target.value) }
                            : c,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!candidate.when}
                    onChange={(e) =>
                      update({
                        ...node,
                        candidates: node.candidates.map((c, index) =>
                          i === index
                            ? {
                                ...c,
                                when: e.target.checked
                                  ? defaultCondition()
                                  : undefined,
                              }
                            : c,
                        ),
                      })
                    }
                  />
                  条件评分
                </label>
                {candidate.when && (
                  <ConditionFields
                    value={candidate.when}
                    onChange={(when) =>
                      update({
                        ...node,
                        candidates: node.candidates.map((c, index) =>
                          i === index ? { ...c, when } : c,
                        ),
                      })
                    }
                  />
                )}
                <button
                  onClick={() =>
                    update({
                      ...node,
                      candidates: node.candidates.filter(
                        (_, index) => i !== index,
                      ),
                    })
                  }
                >
                  删除候选 {i + 1}
                </button>
              </fieldset>
            ))}
            <button
              onClick={() =>
                update({
                  ...node,
                  candidates: [
                    ...node.candidates,
                    {
                      id: `${node.id}-candidate-${Date.now()}`,
                      nodeId: "",
                      weight: 1,
                    },
                  ],
                })
              }
            >
              添加评分候选
            </button>
          </fieldset>
        )}
        {node.type === "module" && (
          <Reference
            label="官方模块绑定"
            value={node.moduleId}
            items={graph.modules.map((m) => ({
              id: m.moduleId,
              name: `${m.kind} · ${m.moduleId}`,
            }))}
            onChange={(moduleId) => update({ ...node, moduleId })}
          />
        )}
        {"fallback" in node &&
          nodeRef("回退到", node.fallback, (fallback) =>
            update({ ...node, fallback }),
          )}
        {node.type === "log" &&
          nodeRef("然后", node.next, (next) => update({ ...node, next }))}
        {(node.type === "log" ||
          node.type === "hold" ||
          node.type === "pass") && (
          <label>
            原因
            <input
              value={node.reason}
              onChange={(e) => update({ ...node, reason: e.target.value })}
            />
          </label>
        )}
      </>
    );
  } else if (selection.kind === "states") {
    const state = graph.states.find((s) => s.id === selection.id);
    if (!state) return null;
    body = (
      <>
        <label>
          状态名称
          <input
            value={state.name}
            onChange={(e) => save({ ...state, name: e.target.value })}
          />
        </label>
        {nodeRef("持续决策树入口", state.treeId, (treeId) =>
          save({ ...state, treeId }),
        )}
        <EffectFields
          label="进入"
          value={state.entry}
          onChange={(entry) => save({ ...state, entry })}
        />
        <EffectFields
          label="退出"
          value={state.exit}
          onChange={(exit) => save({ ...state, exit })}
        />
      </>
    );
  } else if (selection.kind === "transitions") {
    const transition = graph.transitions.find((t) => t.id === selection.id);
    if (!transition) return null;
    body = (
      <>
        {stateRef("来源状态", transition.from, (from) =>
          save({ ...transition, from }),
        )}
        {stateRef("目标状态", transition.to, (to) =>
          save({ ...transition, to }),
        )}
        <label>
          转移优先级
          <input
            type="number"
            value={transition.priority}
            onChange={(e) =>
              save({ ...transition, priority: Number(e.target.value) })
            }
          />
        </label>
        <label>
          冷却步数
          <input
            type="number"
            min="0"
            value={transition.cooldownTicks}
            onChange={(e) =>
              save({ ...transition, cooldownTicks: Number(e.target.value) })
            }
          />
        </label>
        <label>
          最短停留步数
          <input
            type="number"
            min="0"
            value={transition.minStateTicks}
            onChange={(e) =>
              save({ ...transition, minStateTicks: Number(e.target.value) })
            }
          />
        </label>
        <ConditionFields
          value={transition.condition}
          onChange={(condition) => save({ ...transition, condition })}
        />
      </>
    );
  } else if (selection.kind === "roles") {
    const role = graph.roles.find((r) => r.id === selection.id);
    if (!role) return null;
    body = (
      <>
        <label>
          岗位
          <select
            aria-label="岗位"
            value={role.role}
            onChange={(e) =>
              save({ ...role, role: e.target.value as GraphRole["role"] })
            }
          >
            {Object.entries(roleNames).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {stateRef("初始状态", role.initialStateId, (initialStateId) =>
          save({ ...role, initialStateId }),
        )}
        {stateRef("兜底状态", role.fallbackStateId, (fallbackStateId) =>
          save({ ...role, fallbackStateId }),
        )}
      </>
    );
  } else {
    const module = graph.modules.find((m) => m.moduleId === selection.id);
    if (!module) return null;
    body = (
      <BehaviorModuleCard
        module={module}
        expanded={moduleExpanded}
        onToggle={() => setModuleExpanded(!moduleExpanded)}
        onChange={save}
        onSource={() => onLocate(module.moduleId)}
      />
    );
  }
  return (
    <section className="graph-inspector" aria-label="选中规则对象参数">
      <header>
        <code>{selection.id}</code>
        <button onClick={() => onLocate(selection.id)}>定位源码 ↗</button>
      </header>
      {body}
      <small>
        连接选择器只列出对应类型；选择「断开」会保留草稿并报告引用诊断。
      </small>
    </section>
  );
}
