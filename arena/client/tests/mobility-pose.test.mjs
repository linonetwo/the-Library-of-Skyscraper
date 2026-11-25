import test from "node:test";
import assert from "node:assert/strict";
import { sampleMobilityPose } from "../src/mobilityPose.ts";
import { project } from "../src/isoGeometry.ts";
import { resolveAnimation } from "../src/resolveAnimation.ts";
const sample = (u, z, segment = 0) => ({
  worldPosition: { x: u * 2, y: 1 },
  worldHeightMilli: z,
  motionDistanceMilli: u * 2000,
  lastMoveDirection: { x: 1, y: 0 },
  locomotion: {
    kind: "jump",
    phase: u < 0.75 ? "airborne" : "landing",
    progress: u,
  },
  travel: {
    travelId: "one",
    segment,
    segments: [
      {
        kind: "jump",
        role: "gap",
        from: { x: 0, y: 1000, z: 0 },
        to: { x: 2000, y: 1000, z: 0 },
      },
    ],
  },
});
test("known samples interpolate position, height, phase progress and actual distance together without a second arc", () => {
  const pose = sampleMobilityPose(sample(0.25, 900), sample(0.5, 1200), 0.5);
  assert.deepEqual(pose.worldPosition, { x: 0.75, y: 1 });
  assert.equal(pose.worldHeightMilli, 1050);
  assert.equal(pose.locomotion.progress, 0.375);
  assert.equal(pose.motionDistanceMilli, 750);
  assert.deepEqual({ x: pose.x, y: pose.y }, project(0.75, 1, 1.05));
  assert.equal(
    pose.supportHeightMilli,
    0,
    "airborne shadow remains on supporting floor",
  );
});
test("a phase text boundary does not snap the same segment or clip the interpolated frame", () => {
  const pose = sampleMobilityPose(sample(0.5, 1200), sample(0.75, 900), 0.5);
  assert.equal(
    pose.locomotion.phase,
    "landing",
    "phase is the authoritative snapshot label",
  );
  assert.equal(
    pose.locomotion.progress,
    0.625,
    "pose samples known same-segment progress",
  );
});
test("pause, seek, reconnect, segment changes and final landing use the exact authoritative sample", () => {
  for (const [previous, current, snap] of [
    [sample(0.25, 900), sample(0.5, 1200), true],
    [undefined, sample(0.5, 1200), false],
    [sample(0.25, 900), sample(0, 1500, 1), false],
    [sample(0.75, 900), { ...sample(1, 0), travel: null }, false],
  ]) {
    const pose = sampleMobilityPose(previous, current, 0.1, snap);
    assert.equal(pose.worldHeightMilli, current.worldHeightMilli);
    assert.equal(pose.locomotion.progress, current.locomotion.progress);
    assert.deepEqual(pose.worldPosition, current.worldPosition);
    if (snap) assert.equal(pose.moving, false, "paused or seek snapshots have no presentation movement");
  }
  assert.equal(
    sampleMobilityPose(undefined, { worldPosition: { x: 0, y: 0 } }, 0.5),
    undefined,
    "old actors retain the old path",
  );
});
test("ladder facing and platform support use canonical direction and segment roles", () => {
  const current = {
    ...sample(0.5, 1500),
    lastMoveDirection: { x: 0, y: -1 },
    locomotion: { kind: "climb", phase: "crest", progress: 0.5 },
    travel: {
      travelId: "climb",
      segment: 0,
      segments: [{ role: "transfer", from: { z: 1500 }, to: { z: 1500 } }],
    },
  };
  const platform = sampleMobilityPose(undefined, current, 0);
  assert.equal(platform.supportHeightMilli, 1500);
  assert.equal(platform.direction, "NE");
  current.travel.segments[0].role = "ladder";
  assert.equal(sampleMobilityPose(undefined, current, 0).supportHeightMilli, 0);
});
const clip = {
  frameCount: 8,
  frameMs: 250,
  playback: "once",
  groundPivot: [96, 172.8],
};
const actor = {
  hp: 100,
  cargo: 0,
  state: "moving",
  worldPosition: { x: 0, y: 0 },
  lastMoveDirection: { x: 1, y: 0 },
};
const motion = {
  moving: true,
  direction: "S",
  tickDurationMs: 500,
  motionDistanceMilli: 750,
};
test("jump uses normalized segment progress and run uses distance, not a separate elapsed timer", () => {
  const catalog = {
    idle: clip,
    walk: clip,
    jump: clip,
    run: { ...clip, playback: "loop", cycleWorldStride: 1.5 },
  };
  const jump = {
    ...actor,
    locomotion: { kind: "jump", phase: "landing", progress: 0.625 },
  };
  for (const time of [0, 500, 100000])
    assert.equal(resolveAnimation(jump, time, motion, catalog).frame, 5);
  const run = {
    ...actor,
    locomotion: { kind: "run", phase: "run", progress: 0.1 },
  };
  assert.equal(resolveAnimation(run, 0, motion, catalog).frame, 4);
  assert.equal(resolveAnimation(run, 99999, motion, catalog).frame, 4);
});

test("climb retains segment mileage but samples its ladder range once", () => {
  const current = {
    ...sample(0.5, 750),
    locomotion: { kind: "climb", phase: "grip", progress: 0.5 },
    travel: {
      travelId: "climb",
      segment: 1,
      distanceMilli: 2750,
      segments: [
        { lengthMilli: 2000 },
        { lengthMilli: 1500, role: "ladder", from: { z: 0 }, to: { z: 1500 } },
      ],
    },
  };
  const previous = {
    ...current,
    motionDistanceMilli: 10000,
    locomotion: { ...current.locomotion, progress: 1 / 3 },
    travel: { ...current.travel, distanceMilli: 2500 },
  };
  const pose = sampleMobilityPose(previous, current, 0.5);
  assert.equal(pose.locomotionDistanceMilli, 625);
  const catalog = {
    idle: clip,
    walk: clip,
    climb: {
      ...clip,
      frameCount: 24,
      phaseFrames: {
        grip: { first: 0, last: 7, cycleDistanceMilli: 1000 },
        descend: { first: 8, last: 15, cycleDistanceMilli: 1000 },
        crest: { first: 16, last: 23 },
      },
    },
  };
  const climb = { ...actor, locomotion: pose.locomotion };
  assert.equal(
    resolveAnimation(
      climb,
      0,
      { ...motion, locomotionDistanceMilli: 625 },
      catalog,
    ).frame,
    3,
  );
  assert.equal(
    resolveAnimation(
      { ...climb, locomotion: { kind: "climb", phase: "crest", progress: 1 } },
      0,
      motion,
      catalog,
    ).frame,
    23,
  );
});
test("a pure vertical ladder still advances height and distance when ground XY is unchanged", () => {
  const previous = {
    ...sample(0.25, 250),
    worldPosition: { x: -7, y: 1 },
    locomotion: { kind: "climb", phase: "grip", progress: 0.25 },
  };
  const current = {
    ...sample(0.5, 500),
    worldPosition: { x: -7, y: 1 },
    locomotion: { kind: "climb", phase: "grip", progress: 0.5 },
  };
  const pose = sampleMobilityPose(previous, current, 0.5);
  assert.deepEqual(pose.worldPosition, { x: -7, y: 1 });
  assert.equal(pose.worldHeightMilli, 375);
  assert.equal(pose.motionDistanceMilli, 750);
  assert.notEqual(pose.y, project(-7, 1, 0).y);
});
test('unreviewed mobility art stays unavailable and the registered idle remains visible',()=>{
 const catalog={idle:clip,walk:clip};
 for(const kind of ['run','jump','climb']){
  const selected=resolveAnimation({...actor,locomotion:{kind,phase:kind==='climb'?'grip':kind==='jump'?'airborne':'run',progress:.5}},0,motion,catalog);
  assert.equal(selected.requestedClip,kind);
  assert.equal(selected.clip,'idle');
  assert.equal(selected.frame,0);
 }
});
test('partial descriptors play only registered headings and never borrow another direction',()=>{
 const catalog={idle:clip,walk:clip,jump:{...clip,directions:['NE','SW']}};
 const jumping={...actor,locomotion:{kind:'jump',phase:'airborne',progress:.5}};
 const accepted=resolveAnimation({...jumping,lastMoveDirection:{x:0,y:-1}},0,motion,catalog);
 assert.equal(accepted.direction,'NE');assert.equal(accepted.clip,'jump');
 const pending=resolveAnimation(jumping,0,motion,catalog);
 assert.equal(pending.requestedClip,'jump');assert.equal(pending.clip,'idle');
 assert.equal(pending.direction,'SE','unreviewed heading retains its own idle pose');
});

const guardSample = (x, distance) => ({
  ...actor,
  role: "guard",
  state: "fighting",
  roomId: "room-1",
  task: null,
  travel: null,
  worldPosition: { x, y: 1 },
  worldHeightMilli: 0,
  motionDistanceMilli: distance,
});
test("guard approach without a Travel or approaching task interpolates position and walk stride on the same clock", () => {
  const previous = guardSample(0, 0);
  const current = guardSample(0.75, 750);
  const pose = sampleMobilityPose(previous, current, 0.5);
  assert.deepEqual(pose.worldPosition, { x: 0.375, y: 1 });
  assert.equal(pose.motionDistanceMilli, 375);
  assert.equal(pose.moving, true);
  const selected = resolveAnimation(current, 250, { ...motion, ...pose }, {
    idle: clip,
    walk: { ...clip, playback: "loop", cycleWorldStride: 1.5 },
  });
  assert.equal(selected.clip, "walk");
  assert.equal(selected.frame, 2);
  const arrived = sampleMobilityPose(previous, current, 1);
  assert.deepEqual(arrived.worldPosition, current.worldPosition);
  assert.equal(arrived.moving, false);
});
test("ordinary approach snaps on pause, seek, room changes or death and stationary guards stay idle", () => {
  const previous = guardSample(0, 0);
  const current = guardSample(0.75, 750);
  for (const [before, after, snap] of [
    [previous, current, true],
    [undefined, current, false],
    [previous, { ...current, roomId: "room-2" }, false],
    [previous, { ...current, hp: 0 }, false],
    [{ ...previous, hp: 0 }, current, false],
    [previous, { ...current, worldHeightMilli: 100 }, false],
  ]) {
    const pose = sampleMobilityPose(before, after, 0.5, snap);
    assert.deepEqual(pose.worldPosition, after.worldPosition);
    assert.equal(pose.moving, false);
  }
  for (const after of [previous, { ...previous, motionDistanceMilli: 750 }, { ...current, motionDistanceMilli: 0 }]) {
    const pose = sampleMobilityPose(previous, after, 0.5);
    assert.deepEqual(pose.worldPosition, after.worldPosition);
    assert.equal(pose.moving, false);
  }
});

const climbCatalog = {
  idle: clip,
  walk: { ...clip, playback: "loop", cycleWorldStride: 1.5 },
  climb: { ...clip, frameCount: 16, phaseFrames: {
    grip: { first: 0, last: 3, cycleDistanceMilli: 500 },
    descend: { first: 4, last: 7, cycleDistanceMilli: 500 },
    crestUp: { first: 8, last: 11 },
    crestDown: { first: 12, last: 15 },
  } },
};
function ladderSample(reverse, index, progress) {
  const faces = reverse ? [{ x: 0, y: -1 }, { x: 0, y: 1 }] : [{ x: 0, y: 1 }, { x: 0, y: -1 }];
  const roles = ["ladder", "transfer", "traverse", "transfer", "ladder"];
  const segments = roles.map((role, i) => ({
    role, kind: role === "traverse" ? "walk" : "climb",
    from: { x: 0, y: 0, z: role === "ladder" ? 0 : 1500 },
    to: { x: 0, y: 0, z: 1500 }, lengthMilli: 1500,
    ladderFacing: role === "traverse" ? undefined : faces[i < 2 ? 0 : 1],
  }));
  return { ...actor, worldHeightMilli: 1500, motionDistanceMilli: 9000 + progress * 1500,
    locomotion: { kind: segments[index].kind, phase: index === 0 ? "grip" : index === 4 ? "descend" : index === 2 ? "walk" : "crest", progress },
    travel: { travelId: "ladder", segment: index, segments, distanceMilli: index * 1500 + progress * 1500 },
  };
}
test("both directed routes use four closed frame ranges and the same physical ladder facing", () => {
  for (const reverse of [false, true]) for (const index of [0, 1, 3, 4]) {
    for (const [u, offset] of [[0, 0], [.5, 2], [1, 3]]) {
      const current = ladderSample(reverse, index, u);
      for (const snap of [false, true]) {
        const pose = sampleMobilityPose(undefined, current, .1, snap);
        const selected = resolveAnimation(current, 99999, { ...motion, ...pose }, climbCatalog);
        const first = index === 0 ? 0 : index === 4 ? 4 : index === 1 ? 8 : 12;
        assert.equal(selected.frame, first + offset);
        assert.equal(selected.direction, (reverse === (index < 2)) ? "NE" : "SW");
        assert.equal(current.locomotion.phase, index === 0 ? "grip" : index === 4 ? "descend" : "crest");
        if (snap) assert.equal(pose.moving, false);
      }
    }
  }
});
test("transfer key requires ordered neighbours and falls back to an old crest range", () => {
  const current = ladderSample(false, 1, .5);
  const previous = ladderSample(false, 1, 0);
  const pose = sampleMobilityPose(previous, current, .5);
  assert.equal(pose.crestFrameKey, "crestUp");
  assert.equal(pose.locomotion.progress, .25);
  assert.equal(resolveAnimation({ ...current, locomotion: pose.locomotion }, 0, { ...motion, ...pose }, climbCatalog).frame, 9);
  const legacy = { ...climbCatalog, climb: { ...clip, phaseFrames: { crest: { first: 4, last: 7 } } } };
  assert.equal(resolveAnimation(current, 0, { ...motion, ...pose }, legacy).frame, 6);
  current.travel.segments[1].role = "ground";
  assert.equal(sampleMobilityPose(undefined, current, 0).crestFrameKey, undefined);
});
test("paused committed high walkway keeps its mileage stride, while cue direction still wins", () => {
  const current = ladderSample(false, 2, .5);
  const running = sampleMobilityPose(undefined, current, 0);
  const paused = sampleMobilityPose(undefined, current, 0, true);
  assert.equal(paused.moving, false);
  const active = resolveAnimation(current, 0, { ...motion, ...running }, climbCatalog);
  const held = resolveAnimation(current, 99999, { ...motion, ...paused }, climbCatalog);
  assert.equal(held.clip, "walk");
  assert.equal(held.frame, active.frame);
  assert.equal(held.motionDistanceMilli, active.motionDistanceMilli);
  const climbing = ladderSample(false, 1, .5);
  const pose = sampleMobilityPose(undefined, climbing, 0, true);
  const hit = resolveAnimation({ ...climbing, impactCue: { kind: "hit", startedTick: 0, durationTicks: 2 } }, 0, { ...motion, ...pose }, { ...climbCatalog, hit: clip });
  assert.equal(hit.clip, "hit");
  assert.equal(hit.direction, "SE", "impact retains authority heading rather than ladder presentation heading");
});
