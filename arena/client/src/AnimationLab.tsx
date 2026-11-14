import { useEffect, useState } from "react";

const directions = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"];
type Atlas = {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
  meta: { size: { w: number; h: number } };
};

/** Asset inspection, deliberately separate from authoritative game state. */
export default function AnimationLab() {
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(true);
  const [frame, setFrame] = useState(0);
  const [fps, setFps] = useState(8);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/assets/animation/walk-body.json", { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`图集加载失败：${response.status}`);
        return response.json();
      })
      .then(setAtlas)
      .catch(e => { if (e.name !== "AbortError") setError(String(e.message)); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setFrame(value => (value + 1) % 4), 1000 / fps);
    return () => window.clearInterval(timer);
  }, [playing, fps]);
  return (
    <main style={{ maxWidth: 1200, margin: "auto", padding: 32 }}>
      <a href="/">← 返回竞技场</a>
      <h1>纸娃娃动画检查台</h1>
      <p>行走基础体 · 八方向试产 · 非成品验收</p>
      <p role="note">当前不包含动画衣装、发型或武器。侧后方朝向、三头身比例及边缘仍需修整；没有用静态装备覆盖缺失动画。</p>
      <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", margin: "24px 0" }}>
        <button onClick={() => setPlaying(!playing)}>{playing ? "暂停动画" : "播放动画"}</button>
        <button disabled={playing} onClick={() => setFrame((frame + 1) % 4)}>下一帧</button>
        <label>播放速度 <select aria-label="播放速度" value={fps} onChange={e => setFps(Number(e.target.value))}>
          {[2, 4, 8, 12].map(value => <option key={value} value={value}>{value} FPS</option>)}
        </select></label>
        <output aria-label="当前帧">帧 {frame + 1} / 4</output>
      </div>
      {error && <p role="alert">{error}</p>}
      {!atlas && !error && <p role="status">加载图集…</p>}
      <section aria-label="八方向动画预览" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 16 }}>
        {atlas && directions.map(direction => {
          const entry = atlas.frames[`walk/body/${direction}/${String(frame).padStart(2, "0")}`]?.frame;
          return <article key={direction} style={{ padding: 16, border: "1px solid #53615b", background: "#24363c" }}>
            <h2>{direction}{direction === "S" ? " · 面向屏幕" : direction === "N" ? " · 背向屏幕" : ""}</h2>
            {entry ? <div role="img" aria-label={`${direction}方向第${frame + 1}帧`}
              style={{ width: 192, height: 192, margin: "auto",
                backgroundImage: "url(/assets/animation/walk-body.png)",
                backgroundSize: `${atlas.meta.size.w}px ${atlas.meta.size.h}px`,
                backgroundPosition: `-${entry.x}px -${entry.y}px` }} /> : <p role="alert">缺失帧</p>}
            <small>body / prototype · 装备适配未完成</small>
          </article>;
        })}
      </section>
      <p><a href="/assets/animation/coverage.json">查看逐动作、装备、方向覆盖矩阵</a></p>
    </main>
  );
}
