import { solveTwoSegment } from "../../world-chain.mjs";
const add = (a, b) => a.map((n, i) => n + b[i]),
  sub = (a, b) => a.map((n, i) => n - b[i]),
  mul = (a, k) => a.map((n) => n * k),
  norm = (a) => Math.hypot(...a);
const unit = (a) => mul(a, 1 / norm(a));
export const project = ([x, y, z]) => [
  96 + 64 * (x - y),
  172.8 + 32 * (x + y) - 78.38367177 * z,
];
/** Existing planar IK embedded in the anatomical forward/height plane. */
function chain(a, b, lengthA, lengthB, preferred) {
  const delta = sub(b, a),
    u = unit(delta),
    dot = preferred.reduce((n, v, i) => n + v * u[i], 0);
  const v = unit(sub(preferred, mul(u, dot)));
  return solveTwoSegment({
    start: [0, 0],
    target: [norm(delta), 0],
    lengthA,
    lengthB,
    basis: { origin: a, u, v },
  }).world.hinge;
}
export function articulate(
  direction,
  {
    hipZ,
    lean = 0,
    ankles,
    wrists,
    phase,
    contacts,
    staffAngle = 20,
    durationMs,
    ankleAngles = {},
    kneeSpread = 0,
    bodyForward = 0,
    wristWidth = { left: 0.22, right: 0.32 },
    wristTargets = {},
    ankleTargets = {},
    mapTorso = false,
  },
) {
  const heading = direction.worldForward,
    side = [heading[1], -heading[0]],
    wp = (f, l, z) => [
      heading[0] * f + side[0] * l,
      heading[1] * f + side[1] * l,
      z,
    ];
  const south = heading[0] > 0.7 && heading[1] > 0.7;
  // The south rig's pelvic attachment pivot is below its anatomical hip joints.
  const hipHeight = south ? -(direction.joints.leftHip.restOffset[1] + direction.joints.rightHip.restOffset[1]) / 2 / 78.38367177 : 0;
  const pelvisZ = hipZ - hipHeight;
  const neckZ = pelvisZ + Math.sqrt(0.52 ** 2 - lean ** 2),
    world = { pelvis: wp(bodyForward, 0, pelvisZ), neck: wp(bodyForward + lean, 0, neckZ) };
  for (const [s, sign] of [
    ["left", 1],
    ["right", -1],
  ]) {
    world[s + "Hip"] = wp(bodyForward, sign * 0.09, hipZ);
    world[s + "Ankle"] = ankleTargets[s] ?? wp(ankles[s][0], sign * 0.1, ankles[s][1]);
    world[s + "Knee"] = chain(
      world[s + "Hip"],
      world[s + "Ankle"],
      0.3187701178,
      0.3060520193,
      [heading[0] + side[0] * sign * kneeSpread, heading[1] + side[1] * sign * kneeSpread, 0],
    );
    world[s + "Shoulder"] = wp(bodyForward + lean, sign * 0.19, neckZ - 0.065);
    // The accepted north raster has a narrower collar. Preserve its registered
    // shoulder contact instead of placing the independent arm outside the torso.
    if (south || (heading[0] < -0.7 && heading[1] < -0.7)) {
      const [dx, dy] = direction.joints[s + "Shoulder"].restOffset;
      const across = dx / 64, along = (dy - 78.38367177 * 0.065) / 32;
      world[s + "Shoulder"] = add(world.neck, [(along + across) / 2, (along - across) / 2, -0.065]);
    }
    world[s + "Wrist"] = wristTargets[s] ?? wp(
      wrists[s][0],
      sign * wristWidth[s],
      wrists[s][1],
    );
    world[s + "Elbow"] = chain(
      world[s + "Shoulder"],
      world[s + "Wrist"],
      0.252,
      0.214,
      [
        -heading[0] * 0.8 + side[0] * sign * 0.15,
        -heading[1] * 0.8 + side[1] * sign * 0.15,
        -0.2,
      ],
    );
  }
  const points = Object.fromEntries(
    Object.entries(world).map(([id, p]) => [id, project(p)]),
  );
  const jointAngles = {},
    attachmentMappings = {};
  for (const s of ["left", "right"])
    for (const [a, b, part] of [
      ["Hip", "Knee", "thigh"],
      ["Knee", "Ankle", "shin"],
      ["Shoulder", "Elbow", "upper-arm"],
      ["Elbow", "Wrist", "forearm"],
    ]) {
      const from = s + a,
        to = s + b,
        axis = direction.joints[to].restOffset,
        target = sub(points[to], points[from]);
      jointAngles[from] =
        ((Math.atan2(target[1], target[0]) - Math.atan2(axis[1], axis[0])) *
          180) /
        Math.PI;
      const ids =
        part === "forearm"
          ? [s + "-forearm-hand", s + "-forearm", s + "-fore-sleeve"]
          : part === "upper-arm"
            ? [s + "-upper-arm", s + "-upper-sleeve"]
            : [s + "-" + part];
      for (const id of ids)
        attachmentMappings[id] = { axis, scale: norm(target) / norm(axis) };
    }
  const torso = sub(points.neck, points.pelvis),
    axis = direction.joints.neck.restOffset;
  jointAngles.pelvis =
    ((Math.atan2(torso[1], torso[0]) - Math.atan2(axis[1], axis[0])) * 180) /
    Math.PI;
  if (south || mapTorso) for (const attachment of direction.attachments) {
    if (attachment.joint === "pelvis" && attachment.id !== "staff")
      attachmentMappings[attachment.id] = { axis, scale: norm(torso) / norm(axis) };
  }
  jointAngles.neck = 0;
  for (const s of ["left", "right"]) {
    jointAngles[s + "Ankle"] = ankleAngles[s] ?? 0;
    jointAngles[s + "Wrist"] = jointAngles[s + "Elbow"];
  }
  return {
    durationMs,
    joints: {},
    jointPositions: points,
    jointAngles,
    attachmentMappings,
    attachmentAngles: { staff: staffAngle, "right-hand-grip": staffAngle },
    rootScreenDelta: [0, 0],
    supportContacts: { phase, world, contacts },
  };
}
