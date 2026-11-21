const rotate = ([x, y], a) => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
];
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const angle = (v) => Math.atan2(v[1], v[0]);
const length = (v) => Math.hypot(...v);
const degrees = (r) => (r * 180) / Math.PI;
export function skeleton(joints, pose, origin) {
  const result = {};
  function resolve(id) {
    if (result[id]) return result[id];
    const joint = joints[id],
      parent = joint.parent
        ? resolve(joint.parent)
        : { point: origin, angle: 0 };
    const change = pose[id] || {};
    const point = add(
      parent.point,
      rotate(add(joint.restOffset, change.offset || [0, 0]), parent.angle),
    );
    result[id] = {
      point,
      angle: parent.angle + ((change.rotation || 0) * Math.PI) / 180,
    };
    return result[id];
  }
  for (const id of Object.keys(joints)) resolve(id);
  return result;
}
export function lockFoot(direction, pose, origin, foot, target) {
  const joints = direction.joints,
    ankleId = foot.joint,
    kneeId = joints[ankleId].parent,
    hipId = joints[kneeId].parent;
  let state = skeleton(joints, pose, origin);
  const ankleAngle = state[ankleId].angle;
  const destination = sub(
    target,
    rotate(foot.soleOffset || [0, 0], ankleAngle),
  );
  const hip = state[hipId],
    v = sub(destination, hip.point),
    l1 = length(joints[kneeId].restOffset),
    l2 = length(joints[ankleId].restOffset),
    d = length(v);
  if (!l1 || !l2 || !d)
    throw Error("Foot lock requires a nondegenerate hip/knee/ankle chain");
  if (d > l1 + l2 + 0.01 || d < Math.abs(l1 - l2) - 0.01)
    throw Error(
      `Foot target unreachable: ${ankleId} distance ${d.toFixed(2)} lengths ${l1},${l2}`,
    );
  const bend = foot.bend === -1 ? -1 : 1;
  const hipAngle =
    angle(v) +
    bend *
      Math.acos(
        Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))),
      );
  const knee = add(hip.point, [
    l1 * Math.cos(hipAngle),
    l1 * Math.sin(hipAngle),
  ]);
  const kneeAngle = angle(sub(destination, knee));
  const parent = joints[hipId].parent;
  pose[hipId] = {
    ...pose[hipId],
    rotation: degrees(
      hipAngle -
        angle(joints[kneeId].restOffset) -
        (parent ? state[parent].angle : 0),
    ),
  };
  state = skeleton(joints, pose, origin);
  pose[kneeId] = {
    ...pose[kneeId],
    rotation: degrees(
      kneeAngle - angle(joints[ankleId].restOffset) - state[hipId].angle,
    ),
  };
  state = skeleton(joints, pose, origin);
  pose[ankleId] = {
    ...pose[ankleId],
    rotation: degrees(ankleAngle - state[kneeId].angle),
  };
  return skeleton(joints, pose, origin);
}
