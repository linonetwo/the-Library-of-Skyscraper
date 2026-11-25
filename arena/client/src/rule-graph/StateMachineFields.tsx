import type {
  RuleGraph,
  GraphRole,
  GraphState,
  GraphTransition,
} from "../../../behavior-modules/graph";
import { ConditionFields } from "./ConditionFields";
import { EffectFields } from "./EffectFields";
import { GraphReference } from "./GraphReference";
import { nodeNames } from "./graphObjects";
import { roleNames } from "../types";
export function StateMachineFields({
  graph,
  object,
  onChange: save,
}: {
  graph: RuleGraph;
  object:
    | { kind: "states"; value: GraphState }
    | { kind: "transitions"; value: GraphTransition }
    | { kind: "roles"; value: GraphRole };
  onChange: (value: GraphState | GraphTransition | GraphRole) => void;
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
  const stateRef = (
    label: string,
    value: string,
    onChange: (id: string) => void,
  ) => (
    <GraphReference
      label={label}
      value={value}
      items={graph.states}
      onChange={onChange}
    />
  );
  let body;
  if (object.kind === "states") {
    const state = object.value;
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
  } else if (object.kind === "transitions") {
    const transition = object.value;
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
  } else if (object.kind === "roles") {
    const role = object.value;
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
  }
  return body;
}
