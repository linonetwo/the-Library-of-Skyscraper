import { roleNames } from "./types";
import { useArena } from "./ArenaWorkspace";
import type { ActorRole, BehaviorModule } from "../../behavior-modules";
export const moduleNames = {
  gather: "采集藏材",
  haul: "运输入库",
  build: "建造设施",
  defend: "据点防守",
  retreat: "低血撤退",
};
const roles: ActorRole[] = ["gatherer", "guard", "scout"];

export function BehaviorModuleCard({
  module: m,
  onChange,
  onSource,
  expanded,
  onToggle,
}: {
  module: BehaviorModule;
  onChange: (m: BehaviorModule) => void;
  onSource?: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { snapshot } = useArena();
  const rooms = snapshot?.rooms ?? [];
  const roomName = (id?: string) =>
    rooms.find((room) => room.id === id)?.name ?? id ?? "自动选择";
  const summary =
    m.kind === "retreat"
      ? `生命≤${m.config.hpThreshold}`
      : m.kind === "haul"
        ? `藏材≥${m.config.minCargo}`
        : m.kind === "build"
          ? `${roomName(m.config.roomId)} · ${m.config.buildingKind === "catalog" ? "目录馆" : "塔楼"} · 建材≥${m.config.minMaterials}`
          : m.kind === "gather"
            ? roomName(m.config.targetRoomId)
            : roomName(m.config.roomId);
  const roomOptions = (value: string) => (
    <>
      {!rooms.some((room) => room.id === value) && value && (
        <option value={value}>{value} · 当前地图未找到</option>
      )}
      {rooms.map((room) => (
        <option key={room.id} value={room.id}>
          {room.name} · {room.id}
        </option>
      ))}
    </>
  );
  const config = (patch: object) =>
    onChange({ ...m, config: { ...m.config, ...patch } } as BehaviorModule);
  return (
    <article
      className="behavior-card"
      data-enabled={m.enabled}
      id={`module-${m.moduleId}`}
    >
      <header>
        <label>
          <input
            type="checkbox"
            checked={m.enabled}
            onChange={(e) => onChange({ ...m, enabled: e.target.checked })}
          />
          <strong>{moduleNames[m.kind]}</strong>
        </label>
        <span className="behavior-card-summary">
          优先级 {m.priority} · {summary} ·{" "}
          {m.roleFilter?.length
            ? m.roleFilter.map((role) => roleNames[role]).join(" / ")
            : "全部岗位"}
        </span>
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={`params-${m.moduleId}`}
        >
          {expanded ? "收起参数" : "调整参数"}
        </button>
      </header>
      <div id={`params-${m.moduleId}`} hidden={!expanded}>
        {onSource && <button onClick={onSource}>查看源码 ↗</button>}
        <label>
          优先级{" "}
          <input
            aria-label={`${moduleNames[m.kind]}优先级`}
            type="number"
            value={m.priority}
            onChange={(e) =>
              onChange({ ...m, priority: Number(e.target.value) })
            }
          />
        </label>
        <fieldset>
          <legend>适用岗位 · 不勾选即全部</legend>
          {roles.map((role) => (
            <label key={role}>
              <input
                type="checkbox"
                checked={m.roleFilter?.includes(role) ?? false}
                onChange={(e) =>
                  onChange({
                    ...m,
                    roleFilter: e.target.checked
                      ? [...(m.roleFilter ?? []), role]
                      : (m.roleFilter ?? []).filter((r) => r !== role).length
                        ? (m.roleFilter ?? []).filter((r) => r !== role)
                        : undefined,
                  })
                }
              />
              {roleNames[role]}
            </label>
          ))}
        </fieldset>
        {m.kind === "gather" && (
          <label>
            目标房间
            <select
              aria-label="采集目标房间"
              value={m.config.targetRoomId ?? ""}
              onChange={(e) =>
                config({ targetRoomId: e.target.value || undefined })
              }
            >
              <option value="">自动选择</option>
              {roomOptions(m.config.targetRoomId ?? "")}
            </select>
          </label>
        )}
        {m.kind === "defend" && (
          <label>
            防守房间
            <select
              aria-label="防守房间"
              value={m.config.roomId ?? ""}
              onChange={(e) => config({ roomId: e.target.value || undefined })}
            >
              <option value="">自动选择</option>
              {roomOptions(m.config.roomId ?? "")}
            </select>
          </label>
        )}
        {m.kind === "haul" && (
          <label>
            最低携带藏材
            <input
              type="number"
              min="0"
              value={m.config.minCargo}
              onChange={(e) => config({ minCargo: Number(e.target.value) })}
            />
          </label>
        )}
        {m.kind === "retreat" && (
          <label>
            生命值阈值
            <input
              type="number"
              min="0"
              max="100"
              value={m.config.hpThreshold}
              onChange={(e) => config({ hpThreshold: Number(e.target.value) })}
            />
          </label>
        )}
        {m.kind === "build" && (
          <>
            <label>
              建造房间
              <select
                aria-label="建造房间"
                value={m.config.roomId}
                onChange={(e) => config({ roomId: e.target.value })}
              >
                {roomOptions(m.config.roomId)}
              </select>
            </label>
            <label>
              设施
              <select
                aria-label="设施"
                value={m.config.buildingKind}
                onChange={(e) => config({ buildingKind: e.target.value })}
              >
                <option value="catalog">目录馆</option>
                <option value="tower">塔楼</option>
              </select>
            </label>
            <label>
              最低建材
              <input
                type="number"
                min="0"
                value={m.config.minMaterials}
                onChange={(e) =>
                  config({ minMaterials: Number(e.target.value) })
                }
              />
            </label>
          </>
        )}
      </div>
    </article>
  );
}
