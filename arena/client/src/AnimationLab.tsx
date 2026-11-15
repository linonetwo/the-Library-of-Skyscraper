import { useEffect, useState } from "react";
import { AnimatedDollPreview, type AnimationAtlas } from "./AnimatedDollPreview";
import { animationLayerNames, animationLayers } from "./walkLayers";
import "./styles/animation-lab.css";
import type { Outfit } from "./types";

const directionNames: Record<string, string> = {S:"正面",SW:"左前",W:"左侧",NW:"左后",N:"背面",NE:"右后",E:"右侧",SE:"右前"};
const directions = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"];

export default function AnimationLab() {
  const [selectedDirection, setSelectedDirection] = useState("S");
  const [action, setAction] = useState<"idle" | "walk">("idle");
  const [atlases, setAtlases] = useState<Record<string, AnimationAtlas> | null>(null);
  const [haired, setHaired] = useState(true);
  const [hair, setHair] = useState<"ivory" | "midnight">("ivory");
  const [equipped, setEquipped] = useState(true);
  const [weapon, setWeapon] = useState(true);
  const [outfit, setOutfit] = useState<Outfit>("scholar");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(true);
  const [frame, setFrame] = useState(0);
  const [fps, setFps] = useState(4);
  useEffect(() => {
    setError("");
    const controller = new AbortController();
    Promise.all(animationLayerNames[action].map(async name => {
      const response = await fetch(`/assets/animation/${action}-${name}.json`, { signal: controller.signal });
      if (!response.ok) throw new Error(`图集加载失败：${response.status}`);
      return [name, await response.json()] as const;
    })).then(entries => setAtlases(Object.fromEntries(entries)))
      .catch(e => { if (e.name !== "AbortError") setError(String(e.message)); });
    return () => controller.abort();
  }, [action]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setFrame(value => (value + 1) % 4), 1000 / fps);
    return () => window.clearInterval(timer);
  }, [playing, fps]);
  const layers = animationLayers(action, { outfit, hair, weapon })
    .filter(layer => (equipped || !layer.startsWith("outfit-"))
      && (haired || !layer.startsWith("hair-")));
  return (
    <main className="lab">
      <a href="/">← 返回竞技场</a>
      <header className="lab-heading"><small>THE ARCHIVE · CHARACTER ATELIER</small><h1>纸娃娃工坊</h1><p>一呼一吸，一步一向。为书苑旅人试一身新装。</p></header>
      <div className="lab-workbench"><section className="lab-stage" aria-label="角色重点预览"><div className="lab-stage-caption">动作检查 · {directionNames[selectedDirection]}</div><div className="lab-hero">{atlases && <AnimatedDollPreview action={action} atlases={atlases} layers={layers} direction={selectedDirection} frame={frame} />}</div><p>{outfit === "scholar" ? "星墨学者" : "书库守卫"} · {action === "idle" ? "静候下一页" : "行走于书苑"}</p></section><aside className="lab-controls"><h2>动作与播放</h2>
        <label>动作 <select aria-label="动作" value={action} onChange={e => { setAtlases(null); setAction(e.target.value as "idle" | "walk"); setFps(e.target.value === "idle" ? 4 : 8); }}><option value="idle">待机</option><option value="walk">行走</option></select></label>
        <button onClick={() => setPlaying(!playing)}>{playing ? "暂停动画" : "播放动画"}</button>
        <button disabled={playing} onClick={() => setFrame((frame + 1) % 4)}>下一帧</button>
        <label>播放速度 <select aria-label="播放速度" value={fps} onChange={e => setFps(Number(e.target.value))}>
          {[2, 4, 8, 12].map(value => <option key={value} value={value}>{value} FPS</option>)}
        </select></label>
        <output aria-label="当前帧">帧 {frame + 1} / 4</output>
        <h2>衣装与外观</h2>
        <label>衣装 <select aria-label="动画衣装" value={outfit} onChange={e => setOutfit(e.target.value as Outfit)}>
          <option value="scholar">星墨学者</option><option value="warden">书库守卫</option>
        </select></label>
        <label><input type="checkbox" checked={equipped} onChange={e => setEquipped(e.target.checked)} />
          {outfit === "scholar" ? "学者服动画层" : "守卫服动画层"}</label>
        <label>发型 <select aria-label="动画发型" value={hair} onChange={e => setHair(e.target.value as "ivory" | "midnight")}>
          <option value="ivory">月白</option><option value="midnight">午夜</option>
        </select></label>
        <label><input type="checkbox" checked={haired} onChange={e => setHaired(e.target.checked)} />{hair === "ivory" ? "月白" : "午夜"}发型动画层</label>
        <label><input type="checkbox" checked={weapon} onChange={e => setWeapon(e.target.checked)} />法杖动画层</label>
      </aside></div>
      {error && <p role="alert">{error}</p>}
      {!atlases && !error && <p role="status">加载图集…</p>}
      <h2 className="lab-gallery-title">八面观照 <small>点选朝向，细看衣褶与轮廓</small></h2>
      <section aria-label="八方向动画预览" className="lab-gallery">
        {atlases && directions.map(direction => <button className="lab-direction" key={direction}
          aria-label={`${directionNames[direction]} ${direction}`} aria-pressed={direction === selectedDirection}
          onClick={() => setSelectedDirection(direction)}>
          <span className="lab-direction-title">{directionNames[direction]} <small>{direction}</small></span>
          <div className="lab-thumbnail"><AnimatedDollPreview action={action} atlases={atlases} layers={layers} direction={direction} frame={frame} /></div>
        </button>)}
      </section>
      <details className="lab-details"><summary>图层与素材信息</summary>
      <p role="note">身体、两套衣装、两款发型与法杖各有 32 帧独立图集，共用动作、方向和帧号。法杖按握点注册，前后图层随朝向切换；比例、手指握持与完整动作继续精修。</p>
      <a href="/assets/animation/coverage.json">查看逐动作、装备、方向覆盖矩阵</a></details>
    </main>
  );
}
