import { WorldEntities } from "./WorldEntities";
import { animationActions } from "./animationCatalog";
import { useEffect, useRef, useState } from "react";
import { Application, Assets, Container, Texture } from "pixi.js";
import { paintMap, type MapProps } from "./mapScene";
import { mapLayout, mapRoomCenter } from "./mapLayout";
import { project } from "./isoGeometry";
import { CameraController } from "./cameraController";
import { localRoomFocus, type Bounds } from "./mapCamera";
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
    let dynamics: WorldEntities;
    const world = new Container();
    let renderLayer = new Container();
    const entities = new Container({ sortableChildren: true });
    let tiles: Record<string, Texture> = {};
    const controller = new CameraController();
    let bounds: Bounds = { minX: -500, minY: -500, maxX: 500, maxY: 500 };
    let layoutKey = "";
    let poses: ReturnType<ActorScene["render"]> = [];
    let drag: {
      x: number;
      y: number;
      camera: { x: number; y: number; scale: number };
    } | null = null;
    let dragged = false;
    const applyCamera = () => {
      const p = latest.current;
      controller.focus(p.focusIntent);
      const camera = controller.apply(
        bounds,
        host.clientWidth,
        host.clientHeight,
        p.zoom,
        (id) => {
          const actor = poses.find((a) => a.id === id);
          if (!actor) return undefined;
          const unit = p.snapshot?.actors.find((a) => a.id === id),
            room = p.snapshot?.rooms.find((r) => r.id === unit?.roomId);
          if (!room) return actor;
          const center = project(
            mapRoomCenter(
              room,
              (p.snapshot?.simulationVersion ?? 0) >= 3
                ? p.snapshot?.worldMap
                : undefined,
            ).x,
            mapRoomCenter(
              room,
              (p.snapshot?.simulationVersion ?? 0) >= 3
                ? p.snapshot?.worldMap
                : undefined,
            ).y,
          );
          const neighbors = (p.snapshot?.rooms ?? [])
            .filter((r) => {
              const q = r.q - room.q,
                v = r.r - room.r;
              return (Math.abs(q) + Math.abs(v) + Math.abs(q + v)) / 2 <= 1;
            })
            .map((r) =>
              project(
                mapRoomCenter(
                  r,
                  (p.snapshot?.simulationVersion ?? 0) >= 3
                    ? p.snapshot?.worldMap
                    : undefined,
                ).x,
                mapRoomCenter(
                  r,
                  (p.snapshot?.simulationVersion ?? 0) >= 3
                    ? p.snapshot?.worldMap
                    : undefined,
                ).y,
              ),
            );
          return localRoomFocus(
            actor,
            neighbors,
            center,
            { width: host.clientWidth, height: host.clientHeight },
            controller.transform.scale,
          );
        },
        (id) => {
          const r = p.snapshot?.rooms.find((r) => r.id === id);
          return r
            ? project(
                mapRoomCenter(
                  r,
                  (p.snapshot?.simulationVersion ?? 0) >= 3
                    ? p.snapshot?.worldMap
                    : undefined,
                ).x,
                mapRoomCenter(
                  r,
                  (p.snapshot?.simulationVersion ?? 0) >= 3
                    ? p.snapshot?.worldMap
                    : undefined,
                ).y,
              )
            : undefined;
        },
      );
      world.position.set(camera.x, camera.y);
      world.scale.set(camera.scale);
      host.dataset.camera = JSON.stringify(camera);
    };
    const pointerDown = (event: PointerEvent) => {
      drag = {
        x: event.clientX,
        y: event.clientY,
        camera: { ...controller.transform },
      };
      dragged = false;
    };
    const pointerMove = (event: PointerEvent) => {
      if (!drag) return;
      const dx = event.clientX - drag.x,
        dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 5) dragged = true;
      if (dragged) {
        controller.transform = drag.camera;
        controller.pan(dx, dy, host.clientWidth, host.clientHeight);
        applyCamera();
      }
    };
    const pointerUp = () => {
      drag = null;
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = host.getBoundingClientRect();
      controller.wheel(
        event.clientX - rect.left,
        event.clientY - rect.top,
        event.deltaY,
        host.clientWidth,
        host.clientHeight,
        latest.current.zoom,
      );
      applyCamera();
    };
    const paint = () => {
      if (!actors || disposed) return;
      const p = latest.current;
      if (p.suspended) app.stop();
      else if (!document.hidden) app.start();
      host.dataset.roomTargets = JSON.stringify(
        (p.snapshot?.rooms ?? []).map((room) => ({
          id: room.id,
          ...project(
            mapRoomCenter(
              room,
              (p.snapshot?.simulationVersion ?? 0) >= 3
                ? p.snapshot?.worldMap
                : undefined,
            ).x + 2,
            mapRoomCenter(
              room,
              (p.snapshot?.simulationVersion ?? 0) >= 3
                ? p.snapshot?.worldMap
                : undefined,
            ).y + 2,
          ),
        })),
      );
      const key =
        p.snapshot?.mapVersion ??
        JSON.stringify(p.snapshot?.rooms.map((r) => [r.id, r.q, r.r]));
      if (key !== layoutKey) {
        layoutKey = key;
        const points = mapLayout(
          p.snapshot?.rooms ?? [],
          (p.snapshot?.simulationVersion ?? 0) >= 3
            ? p.snapshot?.worldMap
            : undefined,
        ).tiles.map((t) => project(t.x, t.y));
        if (points.length)
          bounds = {
            minX: Math.min(...points.map((p) => p.x)) - 64,
            maxX: Math.max(...points.map((p) => p.x)) + 64,
            minY: Math.min(...points.map((p) => p.y)) - 192,
            maxY: Math.max(...points.map((p) => p.y)) + 112,
          };
        renderLayer.destroy({ children: true });
        renderLayer = new Container();
        world.addChildAt(renderLayer, 0);
        for (const child of [...entities.children])
          if (child.label?.startsWith("shelf:"))
            child.destroy({ children: true });
        paintMap(
          renderLayer,
          {
            ...p,
            onRoom: (id) => {
              if (!dragged) latest.current.onRoom(id);
            },
          },
          entities,
          tiles,
        );
      }
      if (p.snapshot) dynamics.update(p.snapshot);
      actors.update(
        {
          ...p,
          onSelect: (id) => {
            if (!dragged) latest.current.onSelect(id);
          },
        },
        performance.now(),
      );
      poses = actors.render(performance.now());
      host.dataset.actors=JSON.stringify(poses);
      applyCamera();
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
        const actionTextures = await Promise.all(
          animationActions.map(async (action) => {
            const sheets = await Promise.all(
              animationLayerNames[action].map((layer) =>
                Assets.load(`/assets/animation/${action}-${layer}.json`),
              ),
            );
            return [
              action,
              Object.assign({}, ...sheets.map((sheet) => sheet.textures)),
            ] as const;
          }),
        );
        if (latest.current.samplePose) {
          const samples = await Promise.all(
            [
              "body",
              "body-front",
              "outfit-scholar",
              "hair-ivory-back",
              "hair-ivory-front",
            ].map((layer) =>
              Assets.load(`/assets/iso-v030-sample/${layer}.json`),
            ),
          );
          const idle = actionTextures.find(([action]) => action === "idle")!;
          Object.assign(idle[1], ...samples.map((sheet) => sheet.textures));
          const walks = await Promise.all(
            [
              "body",
              "body-front",
              "outfit-scholar",
              "hair-ivory-back",
              "hair-ivory-front",
            ].map((layer) =>
              Assets.load(`/assets/iso-v030-walk-study/walk-${layer}.json`),
            ),
          );
          Object.assign(idle[1], ...walks.map((sheet) => sheet.textures));
        }
        if (disposed) return;
        const manifest = await (
          await fetch("/assets/tiles/manifest.json")
        ).json();
        tiles = Object.fromEntries(
          await Promise.all(
            Object.entries(
              manifest.assets as Record<string, { image: string }>,
            ).map(async ([id, asset]) => [
              id,
              await Assets.load("/assets/tiles/" + asset.image),
            ]),
          ),
        );
        if (disposed) return;
        dynamics = new WorldEntities(entities, tiles);
        actors = new ActorScene(
          Object.fromEntries(
            actionTextures,
          ) as import("./ActorView").DollTextures,
          entities,
        );
        world.addChild(renderLayer, entities);
        app.ticker.add(() => {
          poses = actors.render(performance.now());
          host.dataset.actors = JSON.stringify(poses);
          applyCamera();
        });
        host.appendChild(app.canvas);
        host.style.touchAction = "none";
        app.canvas.addEventListener("pointerdown", pointerDown);
        window.addEventListener("pointermove", pointerMove);
        window.addEventListener("pointerup", pointerUp);
        window.addEventListener("pointercancel", pointerUp);
        app.canvas.addEventListener("wheel", wheel, { passive: false });
        const overviewButton = document.createElement("button");
        overviewButton.textContent = "全图总览";
        overviewButton.setAttribute("aria-label", "全图总览");
        overviewButton.style.cssText =
          "position:absolute;right:18px;bottom:120px;z-index:20";
        overviewButton.onclick = () => {
          controller.overview();
          applyCamera();
        };
        host.appendChild(overviewButton);
        app.stage.addChild(world);
        resize = new ResizeObserver(() => {
          app.renderer.resize(host.clientWidth, host.clientHeight);
          applyCamera();
        });
        resize.observe(host);
        paint();
      } catch (cause) {
        if (!disposed) setError(`地图加载：${(cause as Error).message}`);
      }
    })();
    const visibility = () => {
      if (initialized && !disposed)
        document.hidden || latest.current.suspended ? app.stop() : app.start();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      resize?.disconnect();
      if (initialized)
        app.canvas.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerUp);
      if (initialized) app.canvas.removeEventListener("wheel", wheel);
      document.removeEventListener("visibilitychange", visibility);
      redraw.current = () => {};
      // Live and replay maps share Pixi's global asset and batch pools.
      if (initialized) app.destroy({ removeView: true }, { children: true });
    };
  }, []);

  useEffect(() => {
    redraw.current();
  }, [
    props.suspended,
    props.focusIntent,
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
