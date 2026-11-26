import { articulate } from "./articulation.mjs";
export const climbStride = 0.5;
export const climbPhaseFrames = {
  grip: { first: 0, last: 24 },
  descend: { first: 25, last: 49 },
  crestUp: { first: 50, last: 57 },
  crestDown: { first: 58, last: 65 },
};
const smooth = u => u * u * (3 - 2 * u);
const clamp = u => Math.max(0, Math.min(1, u));
function rung(height, offset, base, lift = 0) {
  const p = (height / climbStride + offset) % 1;
  const support = p < 0.5;
  const anchor = height - p * climbStride + offset * climbStride + base;
  return { support, height: Math.min(1.5, anchor + (support ? 0 : climbStride * smooth((p - 0.5) * 2))) + (support ? 0 : lift * Math.sin(Math.PI * (p - 0.5) * 2)) };
}
/** Complete 1.5m ladder ranges: the 500mm gait never reaches above the top rung. */
export function climbInputs(directionName) {
  const inputs = [];
  for (const descending of [false, true]) for (let frame = 0; frame <= 24; frame++) {
    const u = frame / 24;
    // Only the new E candidate normalizes rung boundaries to the exact 1/16m
    // sample index, so its reversed release is identical to the forward release.
    const rootHeight = directionName === "E" ? (descending ? 24-frame : frame)/16 : 1.5*(descending ? 1-u : u);
    const fold = clamp((rootHeight - 0.5) / 1);
    const ankles = {}, wrists = {}, contacts = {};
    for (const [side, offset] of [["left", 0], ["right", 0.5]]) {
      const foot = rung(rootHeight, offset, 0, 0.04);
      const hand = rung(rootHeight, offset, 1);
      if (directionName === "E" && side === "left" && !foot.support) {
        // A 10mm swing-foot recovery around the first release; supporting feet
        // retain their original rung. The same height window runs in reverse.
        const t = clamp(Math.abs(rootHeight-.25)/.0625);
        foot.height += .01*(1-smooth(t));
      }
      ankles[side] = [0, foot.height - rootHeight + 0.11];
      wrists[side] = [0, hand.height - rootHeight];
      contacts[side] = { support: foot.support, handSupport: hand.support || hand.height === 1.5, rootHeight, footHeight: foot.height, handHeight: hand.height, gesture: "grab" };
    }
    inputs.push({ hipZ: 0.44 - 0.26 * fold, lean: 0.04 + 0.44 * fold, bodyForward: -0.20,
      ankles, wrists, wristWidth: { left: 0.22, right: 0.22 }, phase: descending ? "descend" : "grip",
      contacts, durationMs: 60 });
  }
  for (const descending of [false, true]) for (let frame = 0; frame < 8; frame++) {
    const u = frame / 7, v = descending ? 1-u : u;
    const rise = smooth(clamp((v-3/7)/(4/7)));
    const bodyForward = -.20 + .70*rise - .5*v;
    const ankles = {}, wrists = {}, contacts = {};
    for (const side of ["left", "right"]) {
      const step = smooth(clamp(side === "left" ? v/(3/7) : (v-3/7)/(3/7)));
      const handSupport = side === "left" ? v <= 1/7 : v <= 3/7;
      ankles[side] = [-.5*v+(side === "left" ? .29 : .5)*step, .11+.08*Math.sin(Math.PI*step)];
      wrists[side] = handSupport ? [-.5*v, 0] : [bodyForward+.12, .4+.45*rise];
      contacts[side] = { support: step === 0 || step === 1, handSupport, rootHeight: 1.5,
        footHeight: 1.5+ankles[side][1]-.11, handHeight: handSupport ? 1.5 : undefined,
        rootForward: descending ? -.5*u : .5*u, gesture: side === "right" && handSupport ? "grab" : "brace" };
    }
    inputs.push({ hipZ: .18+.44*rise, lean: .48-.45*rise, bodyForward,
      ankles, wrists, wristWidth: { left: .22, right: .22 }, phase: "crest", crestDescending: descending,
      contacts, durationMs: frame % 4 === 3 ? 70 : 60 });
  }
  return inputs;
}
export function climbPoses(direction) {
  return climbInputs().map(input => articulate(direction, { ...input, staffAngle: direction.stowedStaffAngle ?? 18 }));
}
