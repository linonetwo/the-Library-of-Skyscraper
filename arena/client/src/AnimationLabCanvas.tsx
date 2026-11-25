import { useEffect, useRef, useState } from "react";
import { AnimationLabScene, type LabPose } from "./AnimationLabScene";
export function AnimationLabCanvas(props: LabPose) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<AnimationLabScene | undefined>(undefined);
  const latest = useRef(props);
  latest.current = props;
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);
  const draw = () => {
    if (!scene.current || !host.current) return;
    host.current.dataset.labPoses = JSON.stringify(scene.current.draw(latest.current));
    host.current.dataset.labReady = String(!!latest.current.clip);
  };
  useEffect(() => {
    let disposed = false;
    const pending = new AnimationLabScene();
    void pending.init(host.current!).then(ready => {
      if (disposed) { ready.destroy(); return; }
      scene.current = ready;
      draw();
      setInitialized(true);
    }).catch(cause => { if (!disposed) setError(String(cause)); });
    return () => { disposed = true; scene.current?.destroy(); scene.current = undefined; };
  }, []);
  useEffect(draw, [props.clip, props.direction, props.frame, props.appearance]);
  return <><div className="lab-canvas" ref={host} role="img"
    aria-label={`${props.direction}方向第${props.frame + 1}帧及同帧各方向`} />
    {!initialized && !error && <p role="status">准备预览画布…</p>}
    {error && <p role="alert">{error}</p>}</>;
}
