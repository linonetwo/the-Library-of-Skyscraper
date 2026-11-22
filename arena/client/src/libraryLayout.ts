import { Assets, type Texture } from 'pixi.js';
import environment from '../public/assets/p3-environment/manifest.json';
import { project } from './isoGeometry';
import { roomCenter } from './mapLayout';

/** Protocol room topology mapped onto the common isometric world grid. */
export function floorPoint(q: number, r: number) {
  const p = roomCenter(q, r);
  return project(p.x, p.y);
}

export async function loadLibraryTextures(): Promise<Record<string, Texture>> {
  return Object.fromEntries(await Promise.all(
    Object.entries(environment.assets).map(async ([key, asset]) => [
      key, await Assets.load('/assets/p3-environment/' + asset.image),
    ]),
  ));
}

/** Static pieces share their exported ground pivot and layer; scale is pre-baked. */
export function libraryRegistration(key: string) {
  const spec = environment.assets[key as keyof typeof environment.assets];
  return spec
    ? { anchor: spec.anchor, ground: spec.layer === 'floor-before-props', shadow: false }
    : { anchor: [0.5, 160 / 192], ground: false, shadow: true };
}
