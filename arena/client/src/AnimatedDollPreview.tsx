export type AnimationAtlas = {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
  meta: { size: { w: number; h: number } };
};

export function AnimatedDollPreview({ atlases, layers, direction, frame }: {
  atlases: Record<string, AnimationAtlas>;
  layers: string[];
  direction: string;
  frame: number;
}) {
  const style = (layer: string) => {
    const atlas = atlases[layer];
    const cell = atlas.frames[`walk/${layer}/${direction}/${String(frame).padStart(2, "0")}`].frame;
    return {
      backgroundImage: `url(/assets/animation/walk-${layer}.png)`,
      backgroundSize: `${atlas.meta.size.w}px ${atlas.meta.size.h}px`,
      backgroundPosition: `-${cell.x}px -${cell.y}px`,
    };
  };
  return <div role="img" aria-label={`${direction}方向第${frame + 1}帧`}
    style={{ width: 192, height: 192, margin: "auto", position: "relative",
      backgroundPosition: style("body").backgroundPosition }}>
    {layers.map(layer => <span key={layer} aria-hidden="true"
      className={layer.startsWith("outfit-") ? "animated-outfit"
        : layer.startsWith("hair-") ? "animated-hair"
          : layer.startsWith("weapon-") ? "animated-weapon" : undefined}
      style={{ position: "absolute", inset: 0, ...style(layer) }} />)}
  </div>;
}
