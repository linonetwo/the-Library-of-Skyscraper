import { Container, Rectangle, type Renderer } from "pixi.js";
import { DollRenderer } from "./DollRenderer";
import { loadMainDefinition, prepareMainLayers } from "./dollAssets";
import type { DollAppearance } from "./walkLayers";
const renderers = new Set<Renderer>();
let waiters: ((renderer: Renderer) => void)[] = [];
let queue = Promise.resolve();
const thumbnails = new Map<string, Promise<string>>();
/** The live map's renderer also draws static thumbnails without another graphics context. */
export function useThumbnailRenderer(value: Renderer) {
  renderers.add(value);
  for (const ready of waiters) ready(value);
  waiters = [];
  return () => { renderers.delete(value); };
}
export function dollThumbnail(appearance: DollAppearance) {
  const key = JSON.stringify(appearance);
  let pending = thumbnails.get(key);
  if (!pending) {
    pending = (async () => {
      const set = await loadMainDefinition();
      await prepareMainLayers(set, [appearance], true);
      let result = "";
      const render = queue.then(async () => {
        const shared = renderers.values().next().value ?? await new Promise<Renderer>((ready) => waiters.push(ready));
        const doll = new DollRenderer({});
        const target = new Container();
        target.addChild(doll.node);
        doll.node.position.set(96, 172.8);
        doll.update("idle", 0, "S", appearance, 0, set.clips.idle);
        try {
          const canvas = shared.extract.canvas({ target, frame: new Rectangle(0, 0, 192, 192) });
          result = (canvas as HTMLCanvasElement).toDataURL();
        } finally {
          target.destroy({ children: true });
        }
      });
      queue = render.catch(() => {});
      await render;
      return result;
    })().catch((cause) => { thumbnails.delete(key); throw cause; });
    thumbnails.set(key, pending);
  }
  return pending;
}
