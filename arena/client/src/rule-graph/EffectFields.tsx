import { GraphRoomSelect } from "./GraphRoomSelect";
import type { GraphEffect } from "../../../behavior-modules/graph";
export function EffectFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: GraphEffect[];
  onChange: (value: GraphEffect[]) => void;
}) {
  const edit = (i: number, next: GraphEffect) =>
    onChange(value.map((effect, index) => (i === index ? next : effect)));
  return (
    <fieldset>
      <legend>{label} · 不产生动作意图</legend>
      {value.map((effect, i) => (
        <fieldset key={i}>
          <legend>效果 {i + 1}</legend>
          <label>
            类型
            <select
              value={effect.type}
              onChange={(e) =>
                edit(
                  i,
                  e.target.value === "reason"
                    ? { type: "reason", reason: "" }
                    : e.target.value === "remember"
                      ? { type: "remember", key: "phase", value: "" }
                      : {
                          type: "task",
                          taskId: `plan-${i + 1}`,
                          roomId: "",
                          kind: "move",
                          priority: 1,
                        },
                )
              }
            >
              <option value="reason">记录原因</option>
              <option value="remember">写入记忆</option>
              <option value="task">登记任务计划</option>
            </select>
          </label>
          {effect.type === "reason" && (
            <label>
              原因
              <input
                value={effect.reason}
                onChange={(e) => edit(i, { ...effect, reason: e.target.value })}
              />
            </label>
          )}
          {effect.type === "remember" && (
            <>
              <label>
                记忆键
                <input
                  value={effect.key}
                  onChange={(e) => edit(i, { ...effect, key: e.target.value })}
                />
              </label>
              <label>
                值类型
                <select
                  value={effect.value === null ? "null" : typeof effect.value}
                  onChange={(e) =>
                    edit(i, {
                      ...effect,
                      value:
                        e.target.value === "number"
                          ? 0
                          : e.target.value === "boolean"
                            ? false
                            : e.target.value === "null"
                              ? null
                              : "",
                    })
                  }
                >
                  <option value="string">文字</option>
                  <option value="number">数值</option>
                  <option value="boolean">真假</option>
                  <option value="null">空值</option>
                </select>
              </label>
              {typeof effect.value === "boolean" ? (
                <label>
                  <input
                    type="checkbox"
                    checked={effect.value}
                    onChange={(e) =>
                      edit(i, { ...effect, value: e.target.checked })
                    }
                  />
                  真
                </label>
              ) : (
                effect.value !== null && (
                  <label>
                    记忆值
                    <input
                      type={
                        typeof effect.value === "number" ? "number" : "text"
                      }
                      value={effect.value}
                      onChange={(e) =>
                        edit(i, {
                          ...effect,
                          value:
                            typeof effect.value === "number"
                              ? Number(e.target.value)
                              : e.target.value,
                        })
                      }
                    />
                  </label>
                )
              )}
            </>
          )}
          {effect.type === "task" && (
            <>
              <label>
                任务ID
                <input
                  value={effect.taskId}
                  onChange={(e) =>
                    edit(i, { ...effect, taskId: e.target.value })
                  }
                />
              </label>
              <GraphRoomSelect
                label="任务目标房间"
                value={effect.roomId}
                onChange={(roomId) => edit(i, { ...effect, roomId })}
              />
              <label>
                任务种类
                <select
                  value={effect.kind}
                  onChange={(e) =>
                    edit(i, {
                      ...effect,
                      kind: e.target.value as Extract<
                        GraphEffect,
                        { type: "task" }
                      >["kind"],
                    })
                  }
                >
                  {[
                    "move",
                    "gather",
                    "deliver",
                    "build",
                    "attack",
                    "capture",
                  ].map((kind) => (
                    <option key={kind}>{kind}</option>
                  ))}
                </select>
              </label>
              <label>
                任务优先级
                <input
                  type="number"
                  value={effect.priority}
                  onChange={(e) =>
                    edit(i, { ...effect, priority: Number(e.target.value) })
                  }
                />
              </label>
            </>
          )}
          <button
            onClick={() => onChange(value.filter((_, index) => i !== index))}
          >
            删除效果 {i + 1}
          </button>
        </fieldset>
      ))}
      <button
        onClick={() => onChange([...value, { type: "reason", reason: "" }])}
      >
        添加{label}效果
      </button>
    </fieldset>
  );
}
