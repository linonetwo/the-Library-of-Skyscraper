import { paintMobilitySelection } from "./mapMobility";
import { paintMobilityFacilities } from "./mobilityFacilities";
import { loadLibraryTextures } from './libraryLayout';
import { loadWorldAssets } from "./worldAssets";
import { WorldEntities } from "./WorldEntities";
import { neededMainActions } from "./mainActionNeeds";
import { loadDollTextures, loadMainDefinition, prepareMainLayers } from "./dollAssets";
import { useEffect, useRef, useState } from "react";
import { Application, Assets, Container, Texture } from "pixi.js";
import { paintMap, type MapProps } from "./mapScene";
import { mapLayout, mapRoomCenter } from "./mapLayout";
import { project } from "./isoGeometry";
import { CameraController } from "./cameraController";
import { localRoomFocus, type Bounds } from "./mapCamera";
import { useThumbnailRenderer } from "./dollThumbnail";
import { ActorScene } from "./ActorScene";

/** The application lives for the entire mounted canvas; snapshots only update its render bridge. */
export default function MapCanvas(props: MapProps) {
  const mount = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const redraw = useRef<() => void>(() => {});
  const [error, setError] = useState("");
  const [actorsLoading, setActorsLoading] = useState(true);

  useEffect(() => {
    const host = mount.current!;
    const app = new Application();
    let disposed = false;
    let initialized = false;
    let releaseThumbnailRenderer: (() => void) | undefined;
    let resize: ResizeObserver | undefined;
    let actors: ActorScene;
    let dynamics: WorldEntities;
    const actorTextures: import("./DollRenderer").DollTextures = {};
    let prepareActions: (() => void) | undefined;
    let mainSet: import("./assetSetLoader").LoadedAssetSet | undefined;
    let readyAppearance = "";
    let pendingAppearance = "";
    let preparationRevision = 0;
    const world = new Container();
    let renderLayer = new Container();
    // Whole-edge picking sits above rooms and below actors/interactive entities.
    const edgePickLayer = new Container();
    const mobilitySelection = new Container();
    let mobilityKey = "";
    let authoritySnapshot: MapProps["snapshot"] | undefined;
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
      if (p.fixedCamera) {
        camera.scale = p.fixedCamera.scale;
        camera.x = host.clientWidth / 2 - p.fixedCamera.center.x * camera.scale;
        camera.y =
          host.clientHeight / 2 - p.fixedCamera.center.y * camera.scale;
      }
      world.position.set(camera.x, camera.y);
      world.scale.set(camera.scale);
      host.dataset.camera = JSON.stringify(camera);
      if (
        initialized &&
        !app.ticker.started &&
        !document.hidden
      )
        app.render();
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
      if (p.snapshot !== authoritySnapshot) {
        authoritySnapshot = p.snapshot;
        host.dataset.authorityState = JSON.stringify(p.snapshot && {
          tick: p.snapshot.tick, paused: p.snapshot.paused,
          simulationVersion: p.snapshot.simulationVersion, mapVersion: p.snapshot.mapVersion,
          actors: p.snapshot.actors.map(({ id, owner, role, roomId, hp, cargo, worldPosition,
            worldHeightMilli, lastMoveDirection, locomotion, travel }) => ({
            id, owner, role, roomId, hp, cargo, worldPosition, worldHeightMilli, lastMoveDirection, locomotion, travel,
          })),
          players: p.snapshot.players.map(({ id, script }) => ({ id, script })),
        });
      }
      if (p.suspended || p.snapshot?.paused) app.stop();
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
          if (child.label?.startsWith("shelf:") || child.label?.startsWith("decor:"))
            child.destroy({ children: true });
        for (const child of [...entities.children]) {
          if (child.label?.startsWith("mobility:")) child.destroy({ children: true });
        }
        edgePickLayer.removeChildren().forEach(child => child.destroy({ children: true }));
        if (p.snapshot) paintMobilityFacilities(entities, edgePickLayer, p.snapshot, tiles, (id) => {
          if (!dragged) latest.current.onMobilityEdge?.(id);
        });
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
      const selectedActor = p.snapshot?.actors.find((actor) => actor.id === p.selected);
      const selectedMobility = JSON.stringify([p.snapshot?.mapVersion, p.selected, selectedActor?.roomId,
        selectedActor?.travel?.travelId, selectedActor?.travel?.segments ?? selectedActor?.travel?.path, p.mobilityChoice]);
      if (selectedMobility !== mobilityKey) {
        mobilityKey = selectedMobility;
        mobilitySelection.removeChildren().forEach((child) => child.destroy());
        if (p.snapshot) paintMobilitySelection(mobilitySelection, p.snapshot, selectedActor, p.mobilityChoice ?? null);
      }
      const appearanceKey = p.assetSet ? "sample" : !p.snapshot ? "" :
        (p.snapshot.simulationVersion ?? 0) >= 4
          ? "main:" + JSON.stringify(p.snapshot.actors.map((actor) => actor.appearance))
          : "legacy";
      if (appearanceKey && (readyAppearance !== appearanceKey || pendingAppearance !== appearanceKey)) {
        setActorsLoading(true);
        if (pendingAppearance !== appearanceKey) {
          pendingAppearance = appearanceKey;
          const revision = ++preparationRevision;
          const isCurrent = () => !disposed && revision === preparationRevision && pendingAppearance === appearanceKey;
          prepareActions = undefined;
          let actionSnapshot: typeof p.snapshot;
          let preparedMain: import("./assetSetLoader").LoadedAssetSet | undefined;
          const prepare = p.assetSet ? Promise.resolve() : appearanceKey === "legacy"
            ? loadDollTextures(false).then((textures) => { Object.assign(actorTextures, textures); })
            : loadMainDefinition().then((set) => prepareMainLayers(set, p.snapshot!.actors.map((actor) => actor.appearance)))
                .then((set) => {
                  if (!isCurrent()) return;
                  preparedMain = set;
                  prepareActions = () => {
                    const snapshot = latest.current.snapshot;
                    if (!snapshot || snapshot === actionSnapshot) return;
                    actionSnapshot = snapshot;
                    set.startRemaining(paint, isCurrent, neededMainActions(snapshot));
                  };
                });
          void Promise.all([prepare, p.snapshot ? dynamics.prepare(p.snapshot) : Promise.resolve()]).then(() => {
            if (isCurrent()) {
              if (preparedMain) mainSet = preparedMain;
              readyAppearance = appearanceKey;
              paint();
              prepareActions?.();
            }
          }).catch((cause) => { if (isCurrent()) setError(`角色加载：${String(cause)}`); });
        }
        applyCamera();
        return;
      }
      if (!appearanceKey) { applyCamera(); return; }
      prepareActions?.();
      const now = performance.now();
      actors.update(
        {
          ...p,
          assetSet: p.assetSet ?? (appearanceKey.startsWith("main:") ? mainSet : undefined),
          onSelect: (id) => {
            if (!dragged) latest.current.onSelect(id);
          },
        },
        now,
      );
      if (p.snapshot) dynamics.update(p.snapshot, actors.simulationTime(now), now, p.tacticalPick && {...p.tacticalPick,onPick:(id)=>{if(!dragged)latest.current.tacticalPick?.onPick(id);}});
      poses = actors.render(now);
      setActorsLoading(false);
      host.dataset.enemies = JSON.stringify(dynamics.render(actors.simulationTime(now), now));
      host.dataset.actors = JSON.stringify(poses);
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
        releaseThumbnailRenderer = useThumbnailRenderer(app.renderer);
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
        Object.assign(tiles, await loadLibraryTextures());
        const worldAssets = await loadWorldAssets();
        if (disposed) return;
        dynamics = new WorldEntities(entities, tiles, worldAssets);
        actors = new ActorScene(actorTextures, entities, worldAssets);
        world.addChild(renderLayer, edgePickLayer, entities, mobilitySelection);
        app.ticker.add(() => {
          const now = performance.now();
          poses = actors.render(now);
          host.dataset.enemies = JSON.stringify(dynamics.render(actors.simulationTime(now), now));
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
        if (!latest.current.fixedCamera) host.appendChild(overviewButton);
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
        document.hidden ||
        latest.current.suspended ||
        latest.current.snapshot?.paused
          ? app.stop()
          : app.start();
      if (
        initialized &&
        !disposed &&
        !document.hidden &&
        !latest.current.suspended &&
        latest.current.snapshot?.paused
      )
        applyCamera();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      releaseThumbnailRenderer?.();
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
    props.tacticalPick,
    props.mobilityChoice,
    props.zoom,
    props.showRoutes,
    props.assetSet,
    props.dollAppearance,
    props.sampleWalk,
  ]);

  return (
    <div ref={mount} className="pixi-map" aria-label="等距书苑地图" aria-busy={actorsLoading}>
      {props.snapshot && actorsLoading && <span role="status" style={{position:"absolute",left:"50%",top:"45%",zIndex:1,pointerEvents:"none"}}>角色加载中…</span>}
      {error && (
        <div className="map-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
