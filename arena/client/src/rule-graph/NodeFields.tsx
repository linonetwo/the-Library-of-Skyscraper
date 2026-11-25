import type { RuleGraph, RuleNode } from "../../../behavior-modules/graph";
import { ConditionFields, defaultCondition } from "./ConditionFields";
import { GraphReference } from "./GraphReference";
import { MobilityNodeFields } from "./MobilityNodeFields";
import { nodeNames } from "./graphObjects";
export function NodeFields({
  graph,
  node,
  onChange: update,
}: {
  graph: RuleGraph;
  node: RuleNode;
  onChange: (node: RuleNode) => void;
}) {
  const nodeRef = (
    label: string,
    value: string,
    onChange: (id: string) => void,
  ) => (
    <GraphReference
      label={label}
      value={value}
      items={graph.nodes.map((n) => ({
        id: n.id,
        name: `${nodeNames[n.type]} · ${n.id}`,
      }))}
      onChange={onChange}
    />
  );
  return (
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
      {node.type === "mobility" && <MobilityNodeFields node={node} onChange={update} />}
      {node.type === "module" && (
        <GraphReference
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
}
