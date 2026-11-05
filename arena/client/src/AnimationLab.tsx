import { useEffect, useState } from "react";
import { AnimatedDollPreview, type AnimationAtlas } from "./AnimatedDollPreview";
import { walkLayerNames, walkLayers } from "./walkLayers";
import type { Outfit } from "./types";

const directions = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"];

export default function AnimationLab() {
  const [atlases, setAtlases] = useState<Record<string, AnimationAtlas> | null>(null);
  const [haired, setHaired] = useState(true);
  const [equipped, setEquipped] = useState(true);
  const [weapon, setWeapon] = useState(true);
  const [outfit, setOutfit] = useState<Outfit>("scholar");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(true);
  const [frame, setFrame] = useState(0);
  const [fps, setFps] = useState(8);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(walkLayerNames.map(async name => {
      const response = await fetch(`/assets/animation/walk-${name}.json`, { signal: controller.signal });
      if (!response.ok) throw new Error(`图集加载失败：${response.status}`);
      return [name, await response.json()] as const;
    })).then(entries => setAtlases(Object.fromEntries(entries)))
      .catch(e => { if (e.name !== "AbortError") setError(String(e.message)); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setFrame(value => (value + 1) % 4), 1000 / fps);
    return () => window.clearInterval(timer);
  }, [playing, fps]);
  const layers = walkLayers({ outfit, hair: "ivory", weapon })
    .filter(layer => (equipped || !layer.startsWith("outfit-"))
      && (haired || !layer.startsWith("hair-")));
  return (
    <main style={{ maxWidth: 1200, margin: "auto", padding: 32 }}>
      <a href="/">← 返回竞技场</a>
      <h1>纸娃娃动画检查台</h1>
      <p>行走基础体 + 可替换衣装 + 月白发型 + 法杖 · 八方向试产</p>
      <p role="note">身体、衣装、月白发型与法杖各有 32 帧独立图集，共用动作、方向和帧号。法杖按握点注册，前后图层随朝向切换；比例、手指握持与完整动作继续精修。</p>
      <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", margin: "24px 0" }}>
        <button onClick={() => setPlaying(!playing)}>{playing ? "暂停动画" : "播放动画"}</button>
        <button disabled={playing} onClick={() => setFrame((frame + 1) % 4)}>下一帧</button>
        <label>播放速度 <select aria-label="播放速度" value={fps} onChange={e => setFps(Number(e.target.value))}>
          {[2, 4, 8, 12].map(value => <option key={value} value={value}>{value} FPS</option>)}
        </select></label>
        <output aria-label="当前帧">帧 {frame + 1} / 4</output>
        <label>衣装 <select aria-label="行走衣装" value={outfit} onChange={e => setOutfit(e.target.value as Outfit)}>
          <option value="scholar">星墨学者</option><option value="warden">书库守卫</option>
        </select></label>
        <label><input type="checkbox" checked={equipped} onChange={e => setEquipped(e.target.checked)} />
          {outfit === "scholar" ? "学者服行走层" : "守卫服行走层"}</label>
        <label><input type="checkbox" checked={haired} onChange={e => setHaired(e.target.checked)} />月白发型行走层</label>
        <label><input type="checkbox" checked={weapon} onChange={e => setWeapon(e.target.checked)} />法杖行走层</label>
      </div>
      {error && <p role="alert">{error}</p>}
      {!atlases && !error && <p role="status">加载图集…</p>}
      <section aria-label="八方向动画预览" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 16 }}>
        {atlases && directions.map(direction => <article key={direction}
          style={{ padding: 16, border: "1px solid #53615b", background: "#24363c" }}>
          <h2>{direction}{direction === "S" ? " · 面向屏幕" : direction === "N" ? " · 背向屏幕" : ""}</h2>
          <AnimatedDollPreview atlases={atlases} layers={layers} direction={direction} frame={frame} />
          <small>{outfit} · {weapon ? "持杖" : "空手"} / prototype</small>
        </article>)}
      </section>
      <p><a href="/assets/animation/coverage.json">查看逐动作、装备、方向覆盖矩阵</a></p>
    </main>
  );
}
