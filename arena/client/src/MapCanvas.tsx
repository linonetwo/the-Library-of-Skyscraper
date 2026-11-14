import { useEffect, useRef, useState } from "react";
import { Application, Assets, Container, Texture, Sprite } from "pixi.js";
import { paintMap, type MapProps } from "./mapScene";
import { libraryLayout } from "./libraryLayout";

/** The application lives for the entire mounted canvas; snapshots only update its render bridge. */
export default function MapCanvas(props: MapProps) {
  const mount = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const redraw = useRef<() => void>(() => {});
  const [error, setError] = useState("");

  useEffect(() => {
    const host = mount.current!;
    const app = new Application();
    let disposed = false;
    let initialized = false;
    let resize: ResizeObserver | undefined;
    let frames: Record<string, Texture>;
    const world = new Container();
    let renderLayer = new Container();
    const paint = () => {
      if (!frames || disposed) return;
      const p = latest.current;
      world.position.set(host.clientWidth / 2, host.clientHeight / 2);
      const fit =
        Math.min(host.clientWidth / 922, host.clientHeight / 614, 1.5) * p.zoom;
      world.scale.set(fit);
      renderLayer.destroy({ children: true });
      renderLayer = new Container();
      world.addChild(renderLayer);
      paintMap(renderLayer, p, frames);
    };
    redraw.current = paint;
    void (async () => {
      try {
        await app.init({
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio, 2),
          autoDensity: true,
          resizeTo: host,
          preference: "webgl",
        });
        initialized = true;
        if (disposed) {
          app.destroy({ removeView: true }, { children: true });
          return;
        }
        const sheet = await Assets.load("/assets/doll-atlas.json");
        if (disposed) return;
        frames = sheet.textures;
        const illustration = await Assets.load("/assets/library-map.png");
        if (disposed) return;
        const background = new Sprite(illustration);
        background.anchor.set(0.5);
        background.scale.set(libraryLayout.scale);
        background.alpha = 0.85;
        world.addChild(background);
        host.appendChild(app.canvas);
        app.stage.addChild(world);
        resize = new ResizeObserver(() => {
          app.renderer.resize(host.clientWidth, host.clientHeight);
          paint();
        });
        resize.observe(host);
        paint();
      } catch (cause) {
        if (!disposed) setError(`地图加载：${(cause as Error).message}`);
      }
    })();
    const visibility = () => {
      if (initialized && !disposed) document.hidden ? app.stop() : app.start();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      resize?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      redraw.current = () => {};
      // Live and replay maps share Pixi's global asset and batch pools.
      if (initialized) app.destroy({ removeView: true }, { children: true });
    };
  }, []);

  useEffect(() => {
    redraw.current();
  }, [
    props.snapshot,
    props.selected,
    props.selectedRoom,
    props.outfits,
    props.hairs,
    props.weapons,
    props.zoom,
    props.showRoutes,
  ]);

  return (
    <div ref={mount} className="pixi-map" aria-label="六边形书苑地图">
      {error && (
        <div className="map-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
