import { useEffect, useState } from "react";
import MapCanvas from "./MapCanvas";
import { project } from "./isoGeometry";
import { cameraSampleWorld } from "./cameraSampleWorld";
import { animationLayers, type DollAppearance } from "./walkLayers";
import {
  loadSampleDefinition,
  loadSampleLayers,
  type SampleDefinition,
} from "./sampleAssets";
import type { Texture } from "pixi.js";
const tickMs = 50;
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
  const [tick, setTick] = useState(0),
    [moving, setMoving] = useState(false);
  const [loaded, setLoaded] = useState<{
    variant: string;
    definition: SampleDefinition;
    layers: string[];
    textures: Record<string, Texture>;
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    void loadSampleDefinition(variant)
      .then(async (definition) => {
        const layers = animationLayers(
          "walk",
          { outfit, hair, weapon },
          definition.activeLayers,
        );
        const textures = await loadSampleLayers(definition, layers);
        if (!disposed) setLoaded({ variant, definition, layers, textures });
      })
      .catch((cause) => {
        if (!disposed) setError(String(cause));
      });
    return () => {
      disposed = true;
    };
  }, [variant, outfit, hair, weapon]);
  const length = loaded?.definition.routeLength ?? 12;
  const totalTicks = Math.ceil(((length / speed) * 1000) / tickMs);
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
    }, tickMs);
    return () => clearInterval(timer);
  }, [moving, totalTicks]);
  if (error) return <p>{error}</p>;
  if (!loaded || loaded.variant !== variant) return <p>加载独立动作候选…</p>;
  const definition = loaded.definition;
  const distance = Math.min(length, ((tick * tickMs) / 1000) * speed);
  const snapshot = cameraSampleWorld({
    variant,
    direction,
    tick,
    moving,
    distance,
    length,
    cargo,
    outfit,
    hair,
    weapon,
  });

  return (
    <div className="map-shell">
      <MapCanvas
        key={variant}
        snapshot={snapshot}
        fixedCamera={{ center: project(0, length / 2), scale: 1 }}
        samplePose={direction}
        sampleTextures={loaded.textures}
        sampleLayers={loaded.layers}
        sampleClip={definition.clip}
        sampleRig={definition.rig}
        sampleWalk={walk && tick < totalTicks}
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
              setVariant(e.target.value as typeof variant);
            }}
          >
            <option value="sixteen">16相 · 45ms</option>
            <option value="four">历史4相 · 125ms</option>
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
          {moving ? "暂停" : `沿${length}格道移动1.5格/秒`}
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
          45° / 30° · scale 1 · {length / speed}秒 ·{" "}
          {definition.clip.frameCount}相 ·{" "}
          {Math.round(definition.decodedBytes / 1024)}KiB全层decoded ·
          动态未接受
        </span>
        <a href="/">返回游戏</a>
      </div>
    </div>
  );
}
