import { useEffect, useState } from "react";
import type { Outfit } from "./types";

interface Atlas {
  frames: Record<
    string,
    { frame: { x: number; y: number; w: number; h: number } }
  >;
  meta: { size: { w: number; h: number } };
}
let atlasRequest: Promise<Atlas | null> | undefined;

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
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  useEffect(() => {
    let active = true;
    atlasRequest ||= fetch("/assets/doll-atlas.json")
      .then((r) =>
        r.ok && r.headers.get("content-type")?.includes("json")
          ? r.json()
          : null,
      )
      .catch(() => null);
    atlasRequest.then((value) => {
      if (active) setAtlas(value);
    });
    return () => {
      active = false;
    };
  }, []);
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
      {atlas ? (
        layers.map((name) => {
          const entry = atlas.frames[name] || atlas.frames[`${name}.png`];
          if (!entry) return null;
          const { x, y, w, h } = entry.frame;
          return (
            <div
              key={name}
              className="doll-layer"
              style={{
                aspectRatio: `${w}/${h}`,
                backgroundImage: "url(/assets/doll-atlas.png)",
                backgroundSize: `${(atlas.meta.size.w / w) * 100}% ${(atlas.meta.size.h / h) * 100}%`,
                backgroundPosition: `${atlas.meta.size.w === w ? 0 : (x / (atlas.meta.size.w - w)) * 100}% ${atlas.meta.size.h === h ? 0 : (y / (atlas.meta.size.h - h)) * 100}%`,
              }}
            />
          );
        })
      ) : (
        <div className={`doll-fallback ${hair}`}>
          <span className="doll-head">
            <i />
            <i />
          </span>
          <span className="doll-body" />
          <span className="doll-legs" />
          {weapon && <span className="doll-staff" />}
        </div>
      )}
    </div>
  );
}
