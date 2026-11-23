import { Application, Rectangle } from "pixi.js";
import { DollRenderer } from "./DollRenderer";
import { loadMainDefinition, prepareMainLayers } from "./dollAssets";
import type { DollAppearance } from "./walkLayers";
let renderer: Promise<Application> | undefined;
let queue = Promise.resolve();
const thumbnails = new Map<string, Promise<string>>();
/** One stopped renderer shares the actual doll compositor across all HUD thumbnails. */
export function dollThumbnail(appearance: DollAppearance) {
  const key = JSON.stringify(appearance);
  let pending = thumbnails.get(key);
  if (!pending) {
    pending = (async () => {
      const set = await loadMainDefinition();
      await prepareMainLayers(set, [appearance], true);
      let result = "";
      const render = queue.then(async () => {
        const app = await (renderer ??= (async () => {
          const shared = new Application();
          await shared.init({ width: 192, height: 192, backgroundAlpha: 0, autoStart: false, preference: "webgl" });
          shared.stop();
          return shared;
        })().catch((cause) => { renderer = undefined; throw cause; }));
        const doll = new DollRenderer({});
        doll.node.position.set(96, 172.8);
        doll.update("idle", 0, "S", appearance, 0, set.clips.idle);
        app.stage.addChild(doll.node);
        app.renderer.render(app.stage);
        result = await app.renderer.extract.base64({ target: app.stage, frame: new Rectangle(0, 0, 192, 192) });
        doll.node.destroy({ children: true });
      });
      queue = render.catch(() => {});
      await render;
      return result;
    })();
    pending = pending.catch((cause) => {
      thumbnails.delete(key);
      throw cause;
    });
    thumbnails.set(key, pending);
  }
  return pending;
}
