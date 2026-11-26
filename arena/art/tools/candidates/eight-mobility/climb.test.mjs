import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadClimbRig, here } from "./rig.mjs";
import { climbInputs, climbPhaseFrames } from "./climb.mjs";
import { registerClimbHands, articulateClimb } from "./climb-hands.mjs";
import { project } from "./articulation.mjs";
const config = await loadClimbRig(["NE", "SW"]);
await registerClimbHands(config, path.resolve(here, "../../../iso-v050-mobility/climb-hands/revised/manifest.json"));
const inputs = climbInputs();
const poses = Object.fromEntries(Object.entries(config.directions).map(([name, direction]) => [name, inputs.map(input => articulateClimb(direction, input))]));
const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
test("full finite climb ranges cover every frame and preserve top/bottom/crest joins", () => {
  assert.equal(inputs.length, 66);
  assert.deepEqual(Object.values(climbPhaseFrames).flatMap(range => Array.from({ length: range.last-range.first+1 }, (_,i) => range.first+i)), Array.from({length:66},(_,i)=>i));
  assert.deepEqual(Object.values(climbPhaseFrames).map(range => inputs.slice(range.first, range.last+1).reduce((sum,p)=>sum+p.durationMs,0)), [1500,1500,500,500]);
  for (const [a,b] of [[24,25],[24,50],[49,0],[57,58],[65,25]]) for (const name of ["NE","SW"])
    for (const joint of ["pelvis","neck","leftHip","rightHip","leftAnkle","rightAnkle"])
      assert.deepEqual(poses[name][a].jointPositions[joint], poses[name][b].jointPositions[joint]);
  assert.equal(inputs[0].contacts.left.rootHeight, 0);
  assert.equal(inputs[24].contacts.left.rootHeight, 1.5);
  assert.equal(inputs[49].contacts.left.rootHeight, 0);
});
test("accepted hands and feet meet actual 250mm rungs while root travel stays outside the sprites", () => {
  for (const [name, direction] of Object.entries(config.directions)) for (const [i, pose] of poses[name].entries()) {
    assert.deepEqual(pose.rootScreenDelta, [0,0]);
    const input = inputs[i], h = direction.worldForward, lateral = [h[1],-h[0]];
    for (const [side,sign] of [["left",1],["right",-1]]) {
      const contact = input.contacts[side];
      if (contact.handSupport) {
        assert(contact.handHeight >= 0 && contact.handHeight <= 1.5);
        assert(Math.abs(contact.handHeight*4-Math.round(contact.handHeight*4)) < 1e-10);
      }
      const gesture = contact.gesture, spec = direction.climbHands[side+(gesture === "grab" ? "Grab" : "Brace")];
      const a = pose.attachmentAngles[`${side}-${gesture}-hand`] * Math.PI/180;
      const offset = spec.localContact.map((value,j)=>value-spec.wristPivot[j]);
      const wrist = pose.jointPositions[side+"Wrist"];
      const actual = [wrist[0]+offset[0]*Math.cos(a)-offset[1]*Math.sin(a),wrist[1]+offset[0]*Math.sin(a)+offset[1]*Math.cos(a)];
      assert(distance(actual,pose.handContacts[side].target) < 1e-6, `${name}/${i}/${side} palm contact`);
      const soleOffset = direction.feet[side].soleOffset;
      const actualSole = pose.jointPositions[side+"Ankle"].map((v,j)=>v+soleOffset[j]);
      const f = input.ankles[side][0], z = input.ankles[side][1]-.11;
      const expectedSole = project([h[0]*f+lateral[0]*sign*.1,h[1]*f+lateral[1]*sign*.1,z]);
      assert(distance(actualSole,expectedSole) < 1e-9);
      if (contact.support) assert(Math.abs(contact.footHeight*4-Math.round(contact.footHeight*4)) < 1e-9);
      const world = pose.supportContacts.world;
      for (const [start,end,length] of [["Hip","Knee",.3187701178],["Knee","Ankle",.3060520193],["Shoulder","Elbow",.252],["Elbow","Wrist",.214]])
        assert(Math.abs(distance(world[side+start],world[side+end])-length) < 1e-10);
    }
  }
});
test("climb hips stay on their registered body cutout anchors throughout deep flexion", () => {
  for (const [name, direction] of Object.entries(config.directions)) for (const pose of poses[name]) {
    const axis = direction.joints.neck.restOffset;
    const target = pose.jointPositions.neck.map((v,i) => v-pose.jointPositions.pelvis[i]);
    const scale = Math.hypot(...target) / Math.hypot(...axis);
    const angle = pose.jointAngles.pelvis * Math.PI/180;
    for (const side of ["left", "right"]) {
      const rest = direction.joints[side+"Hip"].restOffset;
      const fraction = rest.reduce((sum,v,i)=>sum+v*axis[i],0)/Math.hypot(...axis)**2;
      const offset = rest.map((v,i)=>v+axis[i]*fraction*(scale-1));
      const expected = [offset[0]*Math.cos(angle)-offset[1]*Math.sin(angle),offset[0]*Math.sin(angle)+offset[1]*Math.cos(angle)].map((v,i)=>v+pose.jointPositions.pelvis[i]);
      assert(distance(expected,pose.jointPositions[side+"Hip"]) < 1e-9, `${name}/${side} raster hip seam`);
    }
  }
});
