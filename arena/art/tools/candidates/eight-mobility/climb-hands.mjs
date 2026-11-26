import { readFile } from "node:fs/promises";
import path from "node:path";
import { articulate, project } from "./articulation.mjs";
const rotate = ([x,y], a) => [x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
/** Accepted independent hands; the manifest owns anatomical side, wrist and hook. */
export async function registerClimbHands(config, manifestFile, names = Object.keys(config.directions)) {
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  for (const name of names) {
    const direction = config.directions[name];
    if (!direction) throw Error("Missing pose direction " + name);
    direction.climbHands = manifest.directions[name];
    if (!direction.climbHands) throw Error("Missing hand registration " + name);
    direction.attachments = direction.attachments.filter(a => !/hand/.test(a.id));
    for (const side of ["left", "right"]) for (const gesture of ["Grab", "Brace"]) {
      const hand = direction.climbHands[side + gesture];
      direction.attachments.push({ id: `${side}-${gesture.toLowerCase()}-hand`, joint: `${side}Wrist`,
        layer: "hand-front", pivot: hand.wristPivot, image: path.resolve(path.dirname(manifestFile), hand.image), zOrder: 30 });
    }
  }
  config.handMode = "natural";
}
/** Solve the wrist from the hook/brace contact, keeping the registered hand intact. */
export function articulateClimb(direction, input) {
  const targets = {}, hooks = {}, ankles = {};
  for (const [side, sign] of [["left",1],["right",-1]]) {
    const spec = direction.climbHands[side + (input.contacts[side].gesture === "grab" ? "Grab" : "Brace")];
    const h = direction.worldForward, lateral = [h[1],-h[0]];
    const f = input.wrists[side][0], z = input.wrists[side][1];
    hooks[side] = project([h[0]*f+lateral[0]*sign*.22,h[1]*f+lateral[1]*sign*.22,z]);
    targets[side] = [h[0]*f+lateral[0]*sign*.22,h[1]*f+lateral[1]*sign*.22,z];
    const sole = direction.feet[side].soleOffset;
    const foot = input.ankles[side];
    ankles[side] = [h[0]*foot[0]+lateral[0]*sign*.1-sole[0]/128,
      h[1]*foot[0]+lateral[1]*sign*.1+sole[0]/128,foot[1]-.11+sole[1]/78.38367177];
  }
  let pose;
  for (let iteration=0;iteration<400;iteration++) {
    pose = articulate(direction, { ...input, mapTorso: true, mapShoulderSockets: direction.climbShoulderSockets ?? [], ankleTargets: ankles, wristTargets: targets, staffAngle: direction.stowedStaffAngle ?? 18 });
    for (const side of ["left","right"]) {
      const gesture = input.contacts[side].gesture, spec = direction.climbHands[side+(gesture === "grab" ? "Grab" : "Brace")];
      const wrist = pose.jointPositions[side+"Wrist"], elbow = pose.jointPositions[side+"Elbow"];
      const normal = spec.wristTowardElbow;
      const angle = Math.atan2(elbow[1]-wrist[1],elbow[0]-wrist[0])-Math.atan2(normal[1],normal[0]);
      const offset = rotate(spec.localContact.map((v,i)=>v-spec.wristPivot[i]),angle);
      const error = hooks[side].map((v,i)=>v-wrist[i]-offset[i]);
      targets[side] = targets[side].map((v,i)=>v+0.1*(i===0?error[0]/128:i===1?-error[0]/128:-error[1]/78.38367177));
      pose.attachmentAngles[`${side}-${gesture}-hand`] = angle*180/Math.PI;
    }
  }
  if (direction.climbLeftThighAxis) {
    // Register only the source cutout to the unchanged anatomical hip/knee.
    const axis = direction.climbLeftThighAxis;
    const target = pose.jointPositions.leftKnee.map((v,i) => v-pose.jointPositions.leftHip[i]);
    pose.attachmentAngles["left-thigh"] = (Math.atan2(target[1],target[0])-Math.atan2(axis[1],axis[0]))*180/Math.PI;
    pose.attachmentMappings["left-thigh"] = { axis, scale: Math.hypot(...target)/Math.hypot(...axis) };
  }
  pose.hiddenAttachments = [];
  pose.handContacts = {};
  for (const side of ["left","right"]) {
    const gesture = input.contacts[side].gesture;
    pose.hiddenAttachments.push(`${side}-${gesture === "grab" ? "brace" : "grab"}-hand`);
    pose.handContacts[side] = { ...input.contacts[side], target: hooks[side] };
  }
  pose.supportContacts.crestDescending = input.crestDescending;
  return pose;
}
