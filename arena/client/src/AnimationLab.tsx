import { useEffect, useRef, useState } from "react";
import { AnimationLabCanvas } from "./AnimationLabCanvas";
import { labDirections } from "./AnimationLabScene";
import { labActionLabels, labFrameTime } from "./animationLabModel";
import { loadMainDefinition } from "./dollAssets";
import { loadAssetSet, type AssetSetIndex, loadClipLayers, type LoadedAssetSet, type RegisteredDollClip } from "./assetSetLoader";
import { animationLayers } from "./walkLayers";
import { clipDuration, frameAt } from "./animationTiming";
import type { Clip } from "./animationCatalog";
import type { Direction } from "./directions";
import type { Outfit } from "./types";
import "./styles/animation-lab.css";
const directionNames: Record<Direction, string> = { S:"正面",SW:"左前",W:"左侧",NW:"左后",N:"背面",NE:"右后",E:"右侧",SE:"右前" };
export default function AnimationLab() {
  const [definition, setDefinition] = useState<LoadedAssetSet>();
  const [clip, setClip] = useState<RegisteredDollClip>();
  const [action, setAction] = useState<Clip>("idle");
  const [direction, setDirection] = useState<Direction>("S");
  const [outfit, setOutfit] = useState<Outfit>("scholar");
  const [hair, setHair] = useState<"ivory" | "midnight">("ivory");
  const [equipped, setEquipped] = useState(true);
  const [haired, setHaired] = useState(true);
  const [weapon, setWeapon] = useState(true);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(true);
  const [frame, setFrame] = useState(0);
  const [fps, setFps] = useState(0);
  const elapsed = useRef(0);
  const appearance = { outfit: equipped ? outfit : "none" as const, hair: haired ? hair : "none" as const, weapon };
  const selection = `${action}/${appearance.outfit}/${appearance.hair}/${weapon}`;
  const [readySelection, setReadySelection] = useState("");
  const readyClip = selection === readySelection ? clip : undefined;
  useEffect(() => {
    let disposed = false;
    const study = new URLSearchParams(window.location.search).get("study") === "cast-recover";
    const definition = study
      ? fetch("/assets/iso-v070-combat-study/index.json").then(response => {
          if (!response.ok) throw new Error(`候选动作索引 ${response.status}`);
          return response.json() as Promise<AssetSetIndex>;
        }).then(loadAssetSet)
      : loadMainDefinition();
    void definition.then(set => { if (!disposed) { setDefinition(set); if (study) setAction(set.clips.cast ? "cast" : "recover"); } })
      .catch(cause => { if (!disposed) setError(String(cause)); });
    return () => { disposed = true; };
  }, []);
  useEffect(() => {
    let disposed = false;
    const selected = definition?.clips[action];
    setError("");
    if (!selected) return;
    const layers = animationLayers("walk", appearance, selected.descriptor.activeLayers, selected.descriptor);
    void loadClipLayers(selected, layers).then(() => {
      if (disposed) return;
      setClip(selected);
      setReadySelection(selection);
      setDirection(current => selected.descriptor.directions.includes(current) ? current : selected.descriptor.directions[0]);
    }).catch(cause => { if (!disposed) setError(String(cause)); });
    return () => { disposed = true; };
  }, [definition, selection]);
  useEffect(() => {
    if (!playing || !readyClip) return;
    let request = 0;
    let previous: number | undefined;
    const timing = readyClip.timing;
    const rate = fps ? fps * clipDuration(timing) / timing.frameCount / 1000 : 1;
    const tick = (now: number) => {
      if (previous !== undefined) elapsed.current += (now - previous) * rate;
      previous = now;
      setFrame(frameAt(timing, elapsed.current));
      if (timing.playback !== "loop" && elapsed.current >= clipDuration(timing)) setPlaying(false);
      else request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, readyClip, fps]);
  const resetAction = (next: Clip) => { setAction(next); setFrame(0); elapsed.current = 0; };
  const step = () => {
    if (!readyClip) return;
    const next = (frame + 1) % readyClip.timing.frameCount;
    elapsed.current = labFrameTime(readyClip.timing, next);
    setFrame(next);
  };
  const active = definition?.clips[action];
  const count = active?.timing.frameCount ?? 0;
  return <main className="lab">
    <a href="/">← 返回竞技场</a>
    <header className="lab-heading"><small>THE ARCHIVE · CHARACTER ATELIER</small><h1>纸娃娃工坊</h1><p>与远征角色共用图集，逐帧查看方向与换装。</p></header>
    <div className="lab-workbench"><section className="lab-stage" aria-label="角色重点预览">
      <div className="lab-stage-caption">{labActionLabels[action]} · {directionNames[direction]}</div>
      <section aria-label="八方向动画预览" className="lab-same-source">
        <AnimationLabCanvas clip={readyClip} direction={direction} frame={frame} appearance={appearance} />
        <nav className="lab-facing-controls" aria-label="选择预览朝向">{labDirections.map(facing => {
          const covered = !!readyClip?.descriptor.directions.includes(facing);
          return <button key={facing} aria-label={`${directionNames[facing]} ${facing}`}
            aria-pressed={covered && facing === direction} disabled={!covered} onClick={() => setDirection(facing)}>
            {directionNames[facing]} {facing}{active && !active.descriptor.directions.includes(facing) && " · 未注册"}</button>;
        })}</nav>
      </section>
    </section><aside className="lab-controls"><h2>动作与播放</h2>
      <label>动作 <select aria-label="动作" value={action} disabled={!definition} onChange={event => resetAction(event.target.value as Clip)}>
        {Object.keys(definition?.clips ?? { idle: null }).map(key => <option key={key} value={key} disabled={key === "cast" && !weapon}>{labActionLabels[key as Clip]}</option>)}
      </select></label>
      <button disabled={!readyClip} onClick={() => {
        if (!playing && readyClip && readyClip.timing.playback !== "loop" && elapsed.current >= clipDuration(readyClip.timing)) { elapsed.current = 0; setFrame(0); }
        setPlaying(!playing);
      }}>{playing ? "暂停动画" : "播放动画"}</button>
      <button disabled={playing || !readyClip} onClick={step}>下一帧</button>
      <label>播放速度 <select aria-label="播放速度" value={fps} onChange={event => setFps(Number(event.target.value))}>
        <option value={0}>素材原速</option>{[2,4,8,12].map(value => <option key={value} value={value}>{value} FPS</option>)}
      </select></label>
      <output aria-label="当前帧">帧 {frame + 1} / {count}</output>
      {active?.descriptor.clip.phaseFrames && <output aria-label="相位帧段">{Object.entries(active.descriptor.clip.phaseFrames).map(([phase, range]) => `${phase} ${range!.first + 1}–${range!.last + 1}`).join("；")}</output>}
      <h2>衣装与外观</h2>
      <label>衣装 <select aria-label="动画衣装" value={outfit} onChange={event => setOutfit(event.target.value as Outfit)}><option value="scholar">星墨学者</option><option value="warden">书库守卫</option></select></label>
      <label><input type="checkbox" checked={equipped} onChange={event => setEquipped(event.target.checked)} />{outfit === "scholar" ? "学者服动画层" : "守卫服动画层"}</label>
      <label>发型 <select aria-label="动画发型" value={hair} onChange={event => setHair(event.target.value as "ivory" | "midnight")}><option value="ivory">月白</option><option value="midnight">午夜</option></select></label>
      <label><input type="checkbox" checked={haired} onChange={event => setHaired(event.target.checked)} />{hair === "ivory" ? "月白" : "午夜"}发型动画层</label>
      <label><input type="checkbox" disabled={!definition} checked={weapon} onChange={event => { setWeapon(event.target.checked); if (!event.target.checked && action === "cast") resetAction(definition?.clips.idle ? "idle" : "recover"); }} />法杖动画层</label>
    </aside></div>
    {error && <p role="alert">{error}</p>}{!readyClip && !error && <p role="status">加载图集…</p>}
    <details className="lab-details"><summary>图层与素材信息</summary><p role="note">身体、衣装、发型和空手／法杖使用远征同源独立图层。动作、方向覆盖与帧段来自当前图集描述；未注册方向留空，不借用其他朝向。</p>
      <a href="/assets/iso-v030-base/index.json">查看当前动作索引</a></details>
  </main>;
}
