const mix = (a, b, t) => a + (b - a) * t;
const point = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const smooth = (t) => t * t * (3 - 2 * t);
const angle = (a, b, t) => a + (((b - a + 540) % 360) - 180) * t;

// Four reviewed semantic controls, sixteen baked samples; stride is projected before this step.
export function sampleWalk(
  direction,
  cycleScreenDelta,
  frames = 16,
  frameMs = 45,
  includeSeam = false,
) {
  const keys = direction.poses;
  const result = [];
  for (let i = 0; i < frames + (includeSeam ? 1 : 0); i++) {
    const phase = (i % frames) / frames,
      segment = Math.floor(phase * 4),
      local = smooth(phase * 4 - segment);
    const a = keys[segment],
      b = keys[(segment + 1) % 4],
      joints = {};
    for (const id of new Set([
      ...Object.keys(a.joints),
      ...Object.keys(b.joints),
    ])) {
      const first = a.joints[id] || {},
        second = b.joints[id] || {};
      joints[id] = {
        rotation: angle(first.rotation || 0, second.rotation || 0, local),
        offset: point(first.offset || [0, 0], second.offset || [0, 0], local),
      };
    }
    const wristTargets = {};
    for (const id of Object.keys(a.wristTargets || {}))
      wristTargets[id] = {
        bend: a.wristTargets[id].bend,
        point: point(a.wristTargets[id].point, b.wristTargets[id].point, local),
      };
    const footTargets = {};
    for (const [side, start] of [
      ["left", 0],
      ["right", 2],
    ]) {
      const contact = keys[start].footTargets[side],
        passing = keys[(start + 3) % 4].footTargets[side];
      const toeoff = contact.map((v, j) => v - cycleScreenDelta[j] / 2);
      const footPhase = (phase + (side === "right" ? 0.5 : 0)) % 1;
      footTargets[side] =
        footPhase < 0.5
          ? contact.map((v, j) => v - cycleScreenDelta[j] * footPhase)
          : footPhase < 0.75
            ? point(toeoff, passing, smooth((footPhase - 0.5) * 4))
            : point(passing, contact, smooth((footPhase - 0.75) * 4));
    }
    result.push({
      durationMs: frameMs,
      joints,
      wristTargets,
      footTargets,
      contactFoot: phase < 0.5 ? "left" : "right",
      rootScreenDelta: cycleScreenDelta.map((v) => (v * i) / frames),
    });
  }
  return result;
}
