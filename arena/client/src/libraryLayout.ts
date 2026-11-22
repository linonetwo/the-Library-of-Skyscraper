import { Assets, type Texture } from 'pixi.js';
type Registration = { anchor: [number, number]; layer: string };
let registrations: Record<string, Registration> = {};
import { project } from './isoGeometry';
import { roomCenter } from './mapLayout';

/** Protocol room topology mapped onto the common isometric world grid. */
export function floorPoint(q: number, r: number) {
  const p = roomCenter(q, r);
  return project(p.x, p.y);
}

export async function loadLibraryTextures(): Promise<Record<string, Texture>> {
  const [manifest, sheet] = await Promise.all([
    fetch('/assets/p3-environment/manifest.json').then(r => r.json()),
    Assets.load('/assets/p3-environment/environment-atlas.json'),
  ]);
  registrations = manifest.assets;
  return sheet.textures;
}

/** Static pieces share their exported ground pivot and layer; scale is pre-baked. */
export function libraryRegistration(key: string) {
  const spec = registrations[key];
  return spec
    ? { anchor: spec.anchor, ground: spec.layer === 'floor-before-props', shadow: false }
    : { anchor: [0.5, 160 / 192], ground: false, shadow: true };
}
