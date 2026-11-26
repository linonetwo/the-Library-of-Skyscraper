/** The independently accepted NE back-carried staff registration (variant B).
 * Apply after posing: inverse rotation gives exactly (+8, 0) screen pixels.
 * Other directions, poses and independent paper-doll layers remain unchanged.
 */
export function registerClimbStaffInset(config) {
  const direction = config.directions.NE;
  if (!direction) return;
  const staff = direction.attachments.find(attachment => attachment.id === "staff");
  if (staff?.layer !== "weapon-staff-back") throw Error("Missing NE back-carried staff");
  const angles = direction.poses.map(pose => pose.attachmentAngles.staff ?? pose.jointAngles[staff.angleJoint ?? staff.joint] ?? 0);
  if (!angles.length || angles.some(angle => Math.abs(angle-angles[0]) > 1e-12)
      || direction.poses.some(pose => pose.attachmentMappings.staff))
    throw Error("NE staff inset requires its original constant rigid registration");
  const angle = angles[0]*Math.PI/180;
  staff.pivot = [staff.pivot[0]-8*Math.cos(angle), staff.pivot[1]+8*Math.sin(angle)];
}
