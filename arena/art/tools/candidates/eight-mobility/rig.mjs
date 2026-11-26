import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const here = path.dirname(fileURLToPath(import.meta.url));
const read = async (file) => JSON.parse(await readFile(file, "utf8"));
/** Resolve frozen registrations; this module never modifies source rasters. */
export async function loadRig(names) {
  const original = await read(path.join(here, "../ne-sw-idle/pose.json"));
  const sixRoot = path.join(here, "../eight-base/inputs/art");
  const six = await read(
    path.join(sixRoot, "attachments-six-directions/rig.json"),
  );
  const equipment = {};
  for (const kind of ["scholar", "warden", "hair", "staff"])
    equipment[kind] = await read(
      `${sixRoot}/equipment-${kind}-additional/attachments.json`,
    );
  const config = structuredClone(original);
  config.directions = {};
  config.layerOrderByDirection = (
    await read(path.join(here, "../eight-base/merged/idle/atlas-budget.json"))
  ).layerOrderByDirection;
  for (const name of names) {
    let d;
    if (original.directions[name]) {
      d = structuredClone(original.directions[name]);
      for (const attachment of d.attachments)
        attachment.image = path.resolve(
          here,
          "../ne-sw-idle",
          attachment.image,
        );
    } else {
      d = structuredClone(six.directions[name]);
      for (const a of d.attachments)
        a.image = path.join(sixRoot, "attachments-six-directions", a.image);
      for (const kind of ["scholar", "warden", "hair"])
        d.attachments.push(
          ...equipment[kind].directions[name].map((a) => ({
            ...a,
            image: path.join(sixRoot, `equipment-${kind}-additional`, a.image),
          })),
        );
      const staff = equipment.staff.directions[name];
      d.attachments = d.attachments.filter(
        (a) => !staff.replaceIds.includes(a.id),
      );
      d.attachments.push(
        ...staff.attachments.map((a) => ({
          ...a,
          image: path.join(sixRoot, "equipment-staff-additional", a.image),
        })),
      );
    }
    d.poses = [];
    config.directions[name] = d;
    const layers = new Set(d.attachments.map((a) => a.layer));
    config.layerOrderByDirection[name] = config.layerOrderByDirection[
      name
    ].filter((layer) => layers.has(layer));
  }
  config.status = "mobility-small-batch-awaiting-independent-review";
  config.releaseApproved = false;
  config.walkApproved = false;
  delete config.sourcePoseOnly;
  delete config.frameMs;
  delete config.breathingPending;
  return config;
}

function useSouthThighCleanup(direction) {
  for (const side of ["left", "right"]) {
    const thigh = direction.attachments.find(a => a.id === side + "-thigh");
    thigh.image = path.resolve(here, "../../../iso-v050-mobility/south-limb-cleanup", side + "-thigh.png");
  }
}

/** South run/jump use clean thighs and an always-visible independent left palm. */
export async function loadRunJumpRig(names) {
  const config = await loadRig(names);
  const direction = config.directions.S;
  if (!direction) return config;
  useSouthThighCleanup(direction);
  const original = direction.attachments.find(a => a.id === "left-forearm-hand");
  direction.attachments = direction.attachments.filter(a => a !== original);
  for (const mode of ["forearm", "natural-hand"]) {
    const palm = mode === "natural-hand";
    direction.attachments.push({ ...original, id: "left-" + mode,
      image: path.join(here, "../eight-work/hands/S/left-" + mode + ".png"),
      joint: palm ? "leftWrist" : "leftElbow",
      pivot: palm ? direction.joints.leftWrist.cell.map((v,i) => v-original.restTopLeft[i]) : original.pivot,
      layer: palm ? "hand-left-front" : original.layer,
      ...(palm ? { angleJoint: "leftElbow" } : {}),
    });
  }
  // The left palm remains above either sleeve for empty and staff modes alike.
  const order = config.layerOrderByDirection.S;
  order.splice(order.indexOf("outfit-warden-front") + 1, 0, "hand-left-front");
  for (const layers of Object.values(config.previewLooks)) layers.push("hand-left-front");
  config.previewLayers.push("hand-left-front");
  return config;
}

/** Accepted carry registrations already separate both forearms and stow the staff. */
export async function loadClimbRig(names) {
  const config = await loadRig(names);
  const nePath = path.join(here, "../ne-sw-carry/pose.json");
  const ne = await read(nePath);
  for (const name of names) {
    let direction;
    if (ne.directions[name]) {
      direction = structuredClone(ne.directions[name]);
      for (const a of direction.attachments)
        a.image = path.resolve(path.dirname(nePath), a.image);
    } else {
      direction = config.directions[name];
      if (name === "S") useSouthThighCleanup(direction);
      if (name === "NW" || name === "SE") direction.climbShoulderSockets = ["left"];
      const original = direction.attachments.find(
        (a) => a.id === "left-forearm-hand",
      );
      direction.attachments = direction.attachments.filter(
        (a) => a.id !== "left-forearm-hand",
      );
      for (const mode of ["forearm", "natural-hand"])
        direction.attachments.push({
          ...original,
          id: "left-" + mode,
          image: path.join(
            here,
            "../eight-work/hands",
            name,
            "left-" + mode + ".png",
          ),
          joint: mode === "forearm" ? "leftElbow" : "leftWrist",
          pivot:
            mode === "forearm"
              ? original.pivot
              : direction.joints.leftWrist.cell.map(
                  (v, i) => v - original.restTopLeft[i],
                ),
          layer: mode === "forearm" ? original.layer : "hand-left-front",
          ...(mode === "natural-hand" ? { angleJoint: "leftElbow" } : {}),
        });
      const staff = direction.attachments.find((a) => a.id === "staff");
      const sign = name === "W" || name === "NW" ? -1 : 1,
        angle = (-sign * 18 * Math.PI) / 180;
      const v = [sign * 10, -17],
        offset = [
          v[0] * Math.cos(angle) - v[1] * Math.sin(angle),
          v[0] * Math.sin(angle) + v[1] * Math.cos(angle),
        ];
      staff.joint = "pelvis";
      staff.layer = "weapon-staff-back";
      staff.pivot = staff.pivot.map((v, i) => v - offset[i]);
    }
    direction.attachments = direction.attachments.filter(
      (a) =>
        !a.layer.startsWith("cargo-bundle") && !a.layer.startsWith("work-prop"),
    );
    direction.stowedStaffAngle =
      ne.directions[name]?.poses[0].attachmentAngles.staff ??
      (name === "W" || name === "NW" ? -18 : 18);
    direction.poses = [];
    config.directions[name] = direction;
  }
  config.handMode = "natural";
  return config;
}
