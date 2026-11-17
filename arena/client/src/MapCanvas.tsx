import { animationActions } from "./animationCatalog";
import { useEffect, useRef, useState } from "react";
import { Application, Assets, Container, Texture } from "pixi.js";
import { paintMap, type MapProps } from "./mapScene";
import { mapLayout } from "./mapLayout";
import { project } from "./isoGeometry";
import { fitMap } from "./mapCamera";
import { ActorScene } from "./ActorScene";
import { animationLayerNames } from "./walkLayers";

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
    let actors: ActorScene;
    const world = new Container();
    let renderLayer = new Container();
    const entities = new Container({sortableChildren:true});
    let tiles:Record<string,Texture> = {};
    const paint = () => {
      if (!actors || disposed) return;
      const p = latest.current;
      const points=mapLayout(p.snapshot?.rooms??[]).tiles.map(t=>project(t.x,t.y));
      if(points.length){const camera=fitMap({minX:Math.min(...points.map(p=>p.x))-64,maxX:Math.max(...points.map(p=>p.x))+64,minY:Math.min(...points.map(p=>p.y))-192,maxY:Math.max(...points.map(p=>p.y))+112},host.clientWidth,host.clientHeight,p.zoom);
       world.position.set(camera.x,camera.y);world.scale.set(camera.scale);host.dataset.camera=JSON.stringify(camera);}
      renderLayer.destroy({children:true});renderLayer=new Container();world.addChildAt(renderLayer,0);
      for(const child of [...entities.children])if(!child.label.startsWith('actor:'))child.destroy({children:true});
      paintMap(renderLayer,p,entities,tiles);
      actors.update(p, performance.now());
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
        const actionTextures = await Promise.all(animationActions.map(async action => {
          const sheets = await Promise.all(animationLayerNames[action].map(layer =>
            Assets.load(`/assets/animation/${action}-${layer}.json`)));
          return [action, Object.assign({}, ...sheets.map(sheet => sheet.textures))] as const;
        }));
        if (disposed) return;
        const manifest=await (await fetch('/assets/tiles/manifest.json')).json();
        tiles=Object.fromEntries(await Promise.all(Object.entries(manifest.assets as Record<string,{image:string}>).map(async([id,asset])=>[id,await Assets.load('/assets/tiles/'+asset.image)])));
        if(disposed)return;
        actors = new ActorScene(Object.fromEntries(actionTextures) as import('./ActorView').DollTextures,entities);
        world.addChild(renderLayer,entities);
        app.ticker.add(() => {
          host.dataset.actors = JSON.stringify(actors.render(performance.now()));
        });
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
    props.zoom,
    props.showRoutes,
  ]);

  return (
    <div ref={mount} className="pixi-map" aria-label="等距书苑地图">
      {error && (
        <div className="map-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
