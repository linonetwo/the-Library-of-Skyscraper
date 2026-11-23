import { Assets, Sprite, type Texture } from "pixi.js";
export type WorldAsset = {
  image: string;
  anchor: [number, number];
  canvas: [number, number];
  attachJoint?: string;
  jointOffset?: [number, number];
  attachments?: Record<string, { offsetScreen: [number, number] }>;
};
export type WorldAssets = {
  specs: Record<string, WorldAsset>;
  textures: Record<string, Texture>;
};
export async function loadWorldAssets(): Promise<WorldAssets> {
  const { assets: specs } = (await fetch(
    "/assets/iso-v030-world/manifest.json",
  ).then((r) => r.json())) as { assets: Record<string, WorldAsset> };
  const textures = Object.fromEntries(
    await Promise.all(
      Object.entries(specs).map(async ([key, entry]) => [
        key,
        await Assets.load("/assets/iso-v030-world/" + entry.image),
      ]),
    ),
  );
  const buildingManifest = await fetch("/assets/p3-buildings/manifest.json").then(r => r.json()) as { assets: Record<string, WorldAsset> };
  const sheet = await Assets.load<import("pixi.js").Spritesheet>("/assets/p3-buildings/buildings-atlas.json");
  Object.assign(specs, buildingManifest.assets);
  Object.assign(textures, sheet.textures);
  return { specs, textures };
}
export function worldSprite(assets: WorldAssets, key: string) {
  const sprite = new Sprite(assets.textures[key]);
  sprite.anchor.set(...assets.specs[key].anchor);
  return sprite;
}

/** Ground origins coincide. All transforms are baked; runtime scale is one. */
export const buildingModules = {
  core: { base: "plinth" }, warehouse: { base: "plinth", upper: "warehouse-upper" },
  tower: { base: "plinth", upper: "tower-upper" }, catalog: { base: "lectern" },
} satisfies Record<import("./types").BuildingType, { base: string; upper?: string }>;
