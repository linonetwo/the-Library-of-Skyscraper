import type {
  GraphCondition,
  GraphField,
} from "../../../behavior-modules/graph";
const fields: Record<GraphField, string> = {
  hp: "生命值",
  cargo: "携带藏材",
  cargoCapacity: "负重容量",
  materials: "库存",
  roomEnemyHp: "房间敌人生命",
  targetEnemyHp: "目标敌人生命",
  tickInState: "状态持续步数",
};
export const defaultCondition = (): GraphCondition => ({
  type: "compare",
  field: "cargo",
  op: "gte",
  value: 6,
  missing: false,
});
export function ConditionFields({
  value,
  onChange,
  label = "条件",
}: {
  value: GraphCondition;
  onChange: (value: GraphCondition) => void;
  label?: string;
}) {
  const changeType = (type: GraphCondition["type"]) =>
    onChange(
      type === "compare"
        ? defaultCondition()
        : type === "atRoom"
          ? { type, roomId: "", missing: false }
          : type === "not"
            ? { type, condition: defaultCondition() }
            : { type, conditions: [defaultCondition()] },
    );
  return (
    <fieldset className="graph-condition">
      <legend>{label}</legend>
      <label>
        判断方式
        <select
          value={value.type}
          onChange={(e) => changeType(e.target.value as GraphCondition["type"])}
        >
          <option value="compare">数值比较</option>
          <option value="atRoom">位于房间</option>
          <option value="all">全部满足</option>
          <option value="any">任意满足</option>
          <option value="not">取反</option>
        </select>
      </label>
      {value.type === "compare" && (
        <>
          <label>
            输入
            <select
              value={value.field}
              onChange={(e) =>
                onChange({ ...value, field: e.target.value as GraphField })
              }
            >
              {Object.entries(fields).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            关系
            <select
              value={value.op}
              onChange={(e) =>
                onChange({
                  ...value,
                  op: e.target.value as Extract<
                    GraphCondition,
                    { type: "compare" }
                  >["op"],
                })
              }
            >
              {[
                ["lt", "<"],
                ["lte", "≤"],
                ["eq", "="],
                ["gte", "≥"],
                ["gt", ">"],
              ].map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            阈值
            <input
              type="number"
              value={value.value}
              onChange={(e) =>
                onChange({ ...value, value: Number(e.target.value) })
              }
            />
          </label>
          <label>
            指定房间 · 留空当前房间
            <input
              value={value.roomId ?? ""}
              onChange={(e) =>
                onChange({ ...value, roomId: e.target.value || undefined })
              }
            />
          </label>
        </>
      )}
      {value.type === "atRoom" && (
        <label>
          房间ID
          <input
            value={value.roomId}
            onChange={(e) => onChange({ ...value, roomId: e.target.value })}
          />
        </label>
      )}
      {"missing" in value && (
        <label>
          <input
            type="checkbox"
            checked={value.missing}
            onChange={(e) => onChange({ ...value, missing: e.target.checked })}
          />
          输入缺失时视为满足
        </label>
      )}
      {(value.type === "all" || value.type === "any") && (
        <>
          {value.conditions.map((condition, i) => (
            <div key={i}>
              <ConditionFields
                value={condition}
                onChange={(next) =>
                  onChange({
                    ...value,
                    conditions: value.conditions.map((c, index) =>
                      index === i ? next : c,
                    ),
                  })
                }
                label={`子条件 ${i + 1}`}
              />
              <button
                onClick={() =>
                  onChange({
                    ...value,
                    conditions: value.conditions.filter(
                      (_, index) => index !== i,
                    ),
                  })
                }
              >
                删除子条件 {i + 1}
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              onChange({
                ...value,
                conditions: [...value.conditions, defaultCondition()],
              })
            }
          >
            添加子条件
          </button>
        </>
      )}
      {value.type === "not" && (
        <ConditionFields
          value={value.condition}
          onChange={(condition) => onChange({ ...value, condition })}
          label="取反的条件"
        />
      )}
    </fieldset>
  );
}
