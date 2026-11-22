import { useEffect, useState } from "react";
import MapCanvas from "./MapCanvas";
import { project } from "./isoGeometry";
import { cameraSampleWorld } from "./cameraSampleWorld";
import { animationLayers, type DollAppearance } from "./walkLayers";
import { loadSampleDefinition, loadSampleLayers } from "./sampleAssets";
import type { Clip } from "./animationCatalog";
import { clipDuration } from "./animationTiming";
import type { SampleStudy } from "./sampleAssets";
const tickMs = 1;
const labels: Partial<Record<Clip, string>> = {
  idle: "呼吸待机",
  walk: "行走",
  attack: "普通攻击（空手手势候选）",
  hit: "受击",
  down: "倒地",
};
const speed = 1.5;
/** Independent art prototype, sharing the real scene, doll sprites and motion resolver. */
export default function CameraSample() {
  const [variant, setVariant] = useState<"four" | "sixteen">("sixteen");
  const [direction, setDirection] = useState<"NE" | "SW">("SW");
  const [outfit, setOutfit] = useState<DollAppearance["outfit"]>("none");
  const [hair, setHair] = useState<DollAppearance["hair"]>("none");
  const [weapon, setWeapon] = useState(false),
    [cargo, setCargo] = useState(false),
    [walk, setWalk] = useState(true);
  const [action, setAction] = useState<Clip>("walk");
  const [tick, setTick] = useState(0),
    [moving, setMoving] = useState(false);
  const [loaded, setLoaded] = useState<{
    variant: string;
    study: SampleStudy;
    action: Clip;
    appearance: DollAppearance;
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    void loadSampleDefinition(variant)
      .then(async (study) => {
        const appearance = { outfit, hair, weapon };
        await loadSampleLayers(study, appearance, cargo, action);
        if (!disposed) setLoaded({ variant, study, action, appearance });
      })
      .catch((cause) => {
        if (!disposed) setError(String(cause));
      });
    return () => {
      disposed = true;
    };
  }, [variant, outfit, hair, weapon, cargo, action]);
  const length = loaded?.study.routeLength ?? 12;
  const active = loaded?.study.set.clips[loaded.action];
  const nativeDuration = active ? clipDuration(active.timing) : 8000;
  const totalTicks =
    loaded?.action === "walk"
      ? (length / speed) * 1000
      : active?.timing.playback === "loop"
        ? Infinity
        : nativeDuration;
  useEffect(() => {
    if (!moving) return;
    const start = performance.now() - tick * tickMs;
    const timer = setInterval(() => {
      const next = Math.min(
        totalTicks,
        Math.floor((performance.now() - start) / tickMs),
      );
      setTick(next);
      if (next >= totalTicks) setMoving(false);
    }, 16);
    return () => clearInterval(timer);
  }, [moving, totalTicks]);
  if (error) return <p>{error}</p>;
  if (!loaded || loaded.variant !== variant) return <p>加载独立动作候选…</p>;
  const study = loaded.study;
  const actualAction = loaded.action;
  const registration = study.set.clips[actualAction]!;
  const distance =
    actualAction === "walk"
      ? Math.min(length, ((tick * tickMs) / 1000) * speed)
      : 0;
  const snapshot = cameraSampleWorld({
    variant,
    action: actualAction,
    durationMs: nativeDuration,
    tickMs,
    direction,
    tick,
    moving,
    distance,
    length,
    cargo,
    ...loaded.appearance,
  });

  return (
    <div className="map-shell">
      <MapCanvas
        key={variant}
        snapshot={snapshot}
        fixedCamera={{ center: project(0, length / 2), scale: 1 }}
        samplePose={direction}
        assetSet={study.set}
        dollAppearance={loaded.appearance}
        sampleWalk={actualAction === "walk" && walk && tick < totalTicks}
        selected="camera-pose"
        selectedRoom={null}
        zoom={1}
        showRoutes
        onSelect={() => {}}
        onRoom={() => {}}
      />
      <div
        className="game-top"
        style={{ zIndex: 30, flexWrap: "wrap", justifyContent: "flex-start" }}
      >
        <strong>相机样板 · 动作候选（未批准）</strong>
        <label>
          步态样板{" "}
          <select
            aria-label="步态样板"
            value={variant}
            onChange={(e) => {
              setMoving(false);
              setTick(0);
              setOutfit("none");
              setHair("none");
              setWeapon(false);
              setAction("walk");
              setVariant(e.target.value as typeof variant);
            }}
          >
            <option value="sixteen">16相 · 45ms</option>
            <option value="four">历史4相 · 125ms</option>
          </select>
        </label>
        <label>
          动作{" "}
          <select
            aria-label="样板动作"
            value={action}
            onChange={(e) => {
              setMoving(false);
              setTick(0);
              setAction(e.target.value as Clip);
            }}
          >
            {Object.keys(study.set.clips).map((key) => (
              <option key={key} value={key}>
                {labels[key as Clip] ?? key}
              </option>
            ))}
          </select>
        </label>
        <label>
          衣装{" "}
          <select
            aria-label="样板衣装"
            value={outfit}
            onChange={(e) => setOutfit(e.target.value as typeof outfit)}
          >
            <option value="none">裸模</option>
            <option value="scholar">学者</option>
            {variant === "sixteen" && <option value="warden">守卫长袖</option>}
          </select>
        </label>
        <label>
          发型{" "}
          <select
            aria-label="样板发型"
            value={hair}
            onChange={(e) => setHair(e.target.value as typeof hair)}
          >
            <option value="none">裸头</option>
            <option value="ivory">象牙白短发</option>
            {variant === "sixteen" && (
              <option value="midnight">午夜束发</option>
            )}
          </select>
        </label>
        {variant === "sixteen" && (
          <label>
            <input
              type="checkbox"
              checked={weapon}
              onChange={(e) => setWeapon(e.target.checked)}
            />
            法杖（握持手互斥）
          </label>
        )}
        <label>
          <input
            type="checkbox"
            checked={walk}
            onChange={(e) => setWalk(e.target.checked)}
          />
          步态相位
        </label>
        <label>
          <input
            type="checkbox"
            checked={cargo}
            onChange={(e) => setCargo(e.target.checked)}
          />
          挂包（手持待制）
        </label>
        <button
          onClick={() => {
            setMoving(false);
            setTick(0);
            setDirection((d) => (d === "NE" ? "SW" : "NE"));
          }}
        >
          {direction} 切换
        </button>
        <button
          onClick={() => {
            if (!moving && tick >= totalTicks) setTick(0);
            setMoving(!moving);
          }}
        >
          {moving
            ? "暂停"
            : actualAction === "walk"
              ? `沿${length}格道移动1.5格/秒`
              : "播放动作"}
        </button>
        <button
          onClick={() => {
            setTick(0);
            setMoving(false);
          }}
        >
          复位
        </button>
        <span>
          45° / 30° · scale 1 ·{" "}
          {actualAction === "walk"
            ? `${length / speed}秒`
            : `${nativeDuration}ms`}{" "}
          · {registration.timing.frameCount}相 ·{" "}
          {Math.round(study.decodedBytes / 1024)}KiB全层decoded · 动态未接受
        </span>
        <label>
          模拟时间{" "}
          <input
            aria-label="样板模拟时间"
            type="range"
            min={0}
            max={
              actualAction === "walk" ? (length / speed) * 1000 : nativeDuration
            }
            step={1}
            value={tick}
            onChange={(e) => {
              setMoving(false);
              setTick(Number(e.target.value));
            }}
          />
          {tick}ms
        </label>
        <a href="/">返回游戏</a>
      </div>
    </div>
  );
}
