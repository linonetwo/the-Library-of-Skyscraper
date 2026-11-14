import type { Outfit } from "./types";
import atlasData from "../public/assets/doll-atlas.json";

interface Atlas {
  frames: Record<
    string,
    { frame: { x: number; y: number; w: number; h: number } }
  >;
  meta: { size: { w: number; h: number } };
}
const atlas: Atlas = atlasData;

export default function PaperDoll({
  outfit = "scholar",
  hair = "ivory",
  weapon = true,
  small = false,
}: {
  outfit?: Outfit;
  hair?: "ivory" | "midnight";
  weapon?: boolean;
  small?: boolean;
}) {
  const layers = [
    "body",
    `outfit-${outfit}`,
    `hair-${hair}`,
    ...(weapon ? ["weapon-staff"] : []),
  ];
  return (
    <div
      className={`paper-doll ${small ? "small" : ""} ${outfit}`}
      aria-label={`${outfit === "scholar" ? "学者长袍" : "守卫制服"}纸娃娃角色`}
    >
      <div className="doll-halo" />
      {layers.map((name) => {
        const { x, y, w, h } = atlas.frames[name].frame;
        return (
          <div
            key={name}
            className="doll-layer"
            style={{
              aspectRatio: `${w}/${h}`,
              backgroundImage: "url(/assets/doll-atlas.png)",
              backgroundSize: `${(atlas.meta.size.w / w) * 100}% ${(atlas.meta.size.h / h) * 100}%`,
              backgroundPosition: `${(x / (atlas.meta.size.w - w)) * 100}% ${(y / (atlas.meta.size.h - h)) * 100}%`,
            }}
          />
        );
      })}
    </div>
  );
}
