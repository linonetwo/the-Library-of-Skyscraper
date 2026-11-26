import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import sharp from "sharp";
import { stamp } from "../../pose-raster.mjs";
import { loadClimbRig, here } from "./rig.mjs";
import { climbInputs, climbPhaseFrames } from "./climb.mjs";
import { registerClimbHands, articulateClimb } from "./climb-hands.mjs";
import { project } from "./articulation.mjs";
import { registerClimbStaffInset } from "./climb-staff.mjs";
const names = (process.env.CLIMB_DIRECTIONS ?? "NE,SW").split(",");
const config = await loadClimbRig(names);
for (const [folder, subset] of [["revised", names.filter(n => n === "NE" || n === "SW")], ["six", names.filter(n => n !== "NE" && n !== "SW")]])
  if (subset.length) await registerClimbHands(config, path.resolve(here, "../../../iso-v050-mobility/climb-hands", folder, "manifest.json"), subset);
const inputs = climbInputs();
const poses = Object.fromEntries(Object.entries(config.directions).map(([name, direction]) => [
  name, climbInputs(name).map((input, frame) => {
    try { return articulateClimb(direction, input); }
    catch (error) { throw new Error(`${name}/${frame}: ${error.message}`, { cause: error }); }
  }),
]));
const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
test("accepted NE staff inset moves only that registration by exactly eight screen pixels", () => {
  if (!config.directions.NE) return;
  const candidate = structuredClone(config);
  for (const [name, direction] of Object.entries(candidate.directions)) direction.poses = structuredClone(poses[name]);
  const before = structuredClone(candidate), oldStaff = before.directions.NE.attachments.find(a => a.id === "staff");
  registerClimbStaffInset(candidate);
  const staff = candidate.directions.NE.attachments.find(a => a.id === "staff");
  for (const pose of candidate.directions.NE.poses) {
    const angle = (pose.attachmentAngles.staff ?? pose.jointAngles[staff.angleJoint ?? staff.joint] ?? 0)*Math.PI/180;
    const delta = oldStaff.pivot.map((v,i) => v-staff.pivot[i]);
    assert(distance([delta[0]*Math.cos(angle)-delta[1]*Math.sin(angle), delta[0]*Math.sin(angle)+delta[1]*Math.cos(angle)], [8,0]) < 1e-12);
  }
  staff.pivot = oldStaff.pivot;
  assert.deepEqual(candidate,before);
});
test("full finite climb ranges cover every frame and preserve top/bottom/crest joins", () => {
  assert.equal(inputs.length, 66);
  assert.deepEqual(Object.values(climbPhaseFrames).flatMap(range => Array.from({ length: range.last-range.first+1 }, (_,i) => range.first+i)), Array.from({length:66},(_,i)=>i));
  assert.deepEqual(Object.values(climbPhaseFrames).map(range => inputs.slice(range.first, range.last+1).reduce((sum,p)=>sum+p.durationMs,0)), [1500,1500,500,500]);
  for (const [a,b] of [[24,25],[24,50],[49,0],[57,58],[65,25]]) for (const name of names)
    for (const joint of ["pelvis","neck","leftHip","rightHip","leftAnkle","rightAnkle"])
      assert.deepEqual(poses[name][a].jointPositions[joint], poses[name][b].jointPositions[joint]);
  assert.equal(inputs[0].contacts.left.rootHeight, 0);
  assert.equal(inputs[24].contacts.left.rootHeight, 1.5);
  assert.equal(inputs[49].contacts.left.rootHeight, 0);
});
test("accepted hands and feet meet actual 250mm rungs while root travel stays outside the sprites", () => {
  for (const [name, direction] of Object.entries(config.directions)) for (const [i, pose] of poses[name].entries()) {
    assert.deepEqual(pose.rootScreenDelta, [0,0]);
    const input = climbInputs(name)[i], h = direction.worldForward, lateral = [h[1],-h[0]];
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
      assert(distance(actual,pose.handContacts[side].target) < 1e-6, `${name}/${i}/${side} palm contact error ${distance(actual,pose.handContacts[side].target)}px`);
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

test("NW climb maps only the near shoulder to the registered torso socket", async () => {
  const rig = await loadClimbRig(["NW"]);
  await registerClimbHands(rig, path.resolve(here, "../../../iso-v050-mobility/climb-hands/six/manifest.json"));
  const direction = rig.directions.NW;
  assert.deepEqual(direction.climbShoulderSockets, ["left"]);
  for (const input of inputs) {
    const pose = articulateClimb(direction, input);
    const axis = direction.joints.neck.restOffset;
    const rest = direction.joints.leftShoulder.restOffset.map((v,i) => v+axis[i]);
    const fraction = rest.reduce((sum,v,i) => sum+v*axis[i],0)/Math.hypot(...axis)**2;
    const target = pose.jointPositions.neck.map((v,i) => v-pose.jointPositions.pelvis[i]);
    const scale = Math.hypot(...target)/Math.hypot(...axis), angle = pose.jointAngles.pelvis*Math.PI/180;
    const offset = rest.map((v,i) => v+axis[i]*fraction*(scale-1));
    const expected = [offset[0]*Math.cos(angle)-offset[1]*Math.sin(angle),offset[0]*Math.sin(angle)+offset[1]*Math.cos(angle)].map((v,i) => v+pose.jointPositions.pelvis[i]);
    assert(distance(expected,pose.jointPositions.leftShoulder)<1e-9);
    const world = pose.supportContacts.world;
    assert(Math.abs(world.leftShoulder[2]-(world.neck[2]-.065))<1e-10);
  }
});


test("E swing recovery is 10mm, leaves stance feet on rungs and reverses exactly", () => {
  const east = climbInputs("E"), original = climbInputs();
  assert.equal(east[4].contacts.left.support, false);
  assert.equal(east[45].contacts.left.support, false);
  assert.equal(east[4].contacts.left.footHeight, .01);
  assert.deepEqual(east[4].ankles, east[45].ankles);
  assert.deepEqual(east[4].contacts, east[45].contacts);
  for (const i of [3,5]) assert.deepEqual(east[i].ankles,original[i].ankles);
  for (const input of east) for (const contact of Object.values(input.contacts))
    if (contact.support) assert(Math.abs(contact.footHeight*4-Math.round(contact.footHeight*4))<1e-9);
});


test("N registered thigh and unchanged shin meet at the actual knee raster", async () => {
  const rig = await loadClimbRig(["N"]);
  await registerClimbHands(rig, path.resolve(here, "../../../iso-v050-mobility/climb-hands/six/manifest.json"));
  const direction = rig.directions.N;
  for (const frame of [0,16,24,50,57,65]) {
    const pose = articulateClimb(direction, climbInputs()[frame]);
    const knee = pose.jointPositions.leftKnee, masks = [];
    for (const id of ["left-thigh", "left-shin"]) {
      const a = direction.attachments.find(a => a.id === id);
      const {data,info} = await sharp(a.image).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      const pixels = Buffer.alloc(192*256*4);
      stamp(pixels,192,256,{data,width:info.width,height:info.height},pose.jointPositions[a.joint],a.pivot,
        (pose.attachmentAngles[id] ?? pose.jointAngles[a.angleJoint ?? a.joint] ?? 0)*Math.PI/180,pose.attachmentMappings[id]);
      const points = [];
      for (let y=0;y<256;y++) for (let x=0;x<192;x++)
        if (pixels[(y*192+x)*4+3]>100 && Math.hypot(x+.5-knee[0],y+.5-knee[1])<8) points.push([x,y]);
      masks.push(points);
    }
    let gap = Infinity;
    for (const a of masks[0]) for (const b of masks[1]) gap = Math.min(gap,distance(a,b));
    assert(gap<=Math.SQRT2, `${frame}: thigh/shin opaque knee masks are not adjacent (${gap}px)`);
  }
});

test("S fold-driven elbow stays readable at former singular frames and reverses deterministically", async () => {
  const rig = await loadClimbRig(["S"]);
  await registerClimbHands(rig, path.resolve(here, "../../../iso-v050-mobility/climb-hands/six/manifest.json"));
  const direction = rig.directions.S;
  const samples = climbInputs("S").map(input => articulateClimb(direction,input));
  for (let frame=0;frame<25;frame++) for (const joint of ["rightShoulder","rightElbow","rightWrist"])
    assert(distance(samples[frame].jointPositions[joint],samples[49-frame].jointPositions[joint])<1e-9);
  for (const frame of [2,5,6,13,36,43,44,47])
    assert(distance(samples[frame].jointPositions.rightElbow,samples[frame].jointPositions.rightWrist)>2,
      `${frame}: right forearm collapses into the wrist projection`);
  for (const [a,b] of [[24,25],[24,50],[49,0],[57,58],[65,25]]) for (const side of ["left","right"])
    assert(distance(samples[a].handContacts[side].target,samples[b].handContacts[side].target)<1e-9);
});
test("S deep crouch retains visible spine depth and uses only a same-frame wrist reference", () => {
  const source = climbInputs(), south = climbInputs("S");
  for (let i=0;i<south.length;i++) {
    if (source[i].lean <= .28) assert.deepEqual(south[i],source[i]);
    else {
      assert.deepEqual(south[i].handSeedTorso, {hipZ:source[i].hipZ,lean:source[i].lean});
      assert(source[i].hipZ-south[i].hipZ <= .040+1e-12);
      assert(south[i].lean <= .36+1e-12);
    }
    assert.deepEqual(south[i].ankles,source[i].ankles);
    assert.deepEqual(south[i].wrists,source[i].wrists);
    assert.deepEqual(south[i].contacts,source[i].contacts);
  }
  for (const i of [24,25,50,65]) {
    assert(Math.abs(south[i].hipZ-.14)<1e-12);
    assert(Math.abs(south[i].lean-.36)<1e-12);
  }
  for (const name of ["NE","SW","N","NW","W","E","SE"])
    assert(climbInputs(name).every(input => !input.handSeedTorso));
});
