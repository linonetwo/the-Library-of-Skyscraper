import { useEffect, useState } from "react";
import MapCanvas from "./MapCanvas";
import type { Snapshot } from "./types";
const rooms: Snapshot["rooms"] = [
  {
    id: "sample-a",
    q: 0,
    r: 0,
    name: "相机样板",
    kind: "base",
    resources: 0,
    enemyHp: 0,
    owner: null,
  },
  {
    id: "sample-b",
    q: 1,
    r: 0,
    name: "8格路端",
    kind: "catalog",
    resources: 0,
    enemyHp: 0,
    owner: null,
  },
];
/** Isolated pose-only asset review; never changes the gameplay atlas. */
export default function CameraSample() {
  const [direction, setDirection] = useState<"NE" | "SW">("SW");
  const [outfit, setOutfit] = useState(false),
    [hair, setHair] = useState(false);
  const [walk, setWalk] = useState(false);
  const [frameMs, setFrameMs] = useState(125);
  useEffect(() => {
    void fetch("/assets/iso-v030-walk-study/pose.json")
      .then((r) => r.json())
      .then((p) => setFrameMs(p.directions.NE.poses[0].durationMs));
  }, []);
  const [tick, setTick] = useState(0);
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    if (!moving) return;
    if (tick >= Math.ceil(8 / 0.75)) {
      setMoving(false);
      return;
    }
    const timer = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(timer);
  }, [moving, tick]);
  const distance = Math.min(8, tick * 0.75);
  const y = direction === "NE" ? 8 - distance : distance;
  const snapshot: Snapshot = {
    sessionId: "camera-sample",
    mode: "training",
    seed: 1,
    tick,
    paused: !moving,
    phase: "running",
    tickDurationMs: 500,
    mapVersion: "camera-sample",
    simulationVersion: 3,
    worldMap: {
      version: "camera-sample",
      rooms: [
        { id: "sample-a", center: { x: 0, y: 0 }, floorHalfSize: 1 },
        { id: "sample-b", center: { x: 0, y: 8 }, floorHalfSize: 1 },
      ],
      props: [
        {
          id: "u",
          roomId: "sample-a",
          asset: "bookcase-u",
          position: { x: -1, y: -1 },
          footprint: { width: 1, depth: 1 },
        },
        {
          id: "v",
          roomId: "sample-b",
          asset: "bookcase-v",
          position: { x: 1, y: 7 },
          footprint: { width: 1, depth: 1 },
        },
      ],
      links: [
        {
          from: "sample-a",
          to: "sample-b",
          points: [
            { x: 0, y: 0 },
            { x: 0, y: 8 },
          ],
        },
      ],
    },
    rooms,
    players: [],
    actors: [
      {
        id: "camera-pose",
        owner: "sample",
        role: "scout",
        roomId: "sample-a",
        worldPosition: { x: 0, y },
        hp: 100,
        maxHp: 100,
        cargo: 0,
        cargoCapacity: 12,
        state: "idle",
        appearance: { outfit: "scholar", hair: "ivory", weapon: false },
      },
    ],
    buildings: [
      {
        id: "lectern",
        owner: "sample",
        roomId: "sample-b",
        kind: "catalog",
        hp: 100,
        maxHp: 100,
      },
    ],
    events: [],
    result: null,
  };
  return (
    <div className="map-shell">
      <MapCanvas
        snapshot={snapshot}
        samplePose={direction}
        sampleOutfit={outfit}
        sampleHair={hair}
        sampleWalk={walk && tick < Math.ceil(8 / 0.75)}
        sampleFrameMs={frameMs}
        selected="camera-pose"
        selectedRoom={null}
        zoom={1}
        showRoutes
        onSelect={() => {}}
        onRoom={() => {}}
      />
      <div className="game-top" style={{ zIndex: 30 }}>
        <label>
          <input
            type="checkbox"
            checked={outfit}
            onChange={(e) => setOutfit(e.target.checked)}
          />
          学者衣装
        </label>
        <label>
          <input
            type="checkbox"
            checked={hair}
            onChange={(e) => setHair(e.target.checked)}
          />
          象牙白发
        </label>
        <label>
          <input
            type="checkbox"
            checked={walk}
            onChange={(e) => setWalk(e.target.checked)}
          />
          两向步态候选
        </label>
        <strong>相机样板 · 独立美术候选（未发布）</strong>
        <span>45° / 30° · 1格=1m · 人高1.7m · renderScale 1</span>
        <button onClick={() => setDirection((d) => (d === "NE" ? "SW" : "NE"))}>
          {direction} 切换
        </button>
        <button onClick={() => setMoving(!moving)}>
          {moving ? "暂停" : "沿8格道移动1.5格/秒"}
        </button>
        <button
          onClick={() => {
            setTick(0);
            setMoving(false);
          }}
        >
          复位
        </button>
        <a href="/">返回游戏</a>
      </div>
    </div>
  );
}
