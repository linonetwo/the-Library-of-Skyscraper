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
