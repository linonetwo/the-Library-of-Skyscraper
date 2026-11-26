import test from "node:test";
import assert from "node:assert/strict";
import { loadRig, loadRunJumpRig } from "./rig.mjs";
import { runPoses, runStride } from "./run.mjs";
import { jumpPoses } from "./jump.mjs";
const distance = (a, b) => Math.hypot(...a.map((n, i) => n - b[i]));
const rig = await loadRig(["NE", "SW", "E", "W", "N", "S", "NW", "SE"]);
test("new run has stance and flight with a distinct authoritative distance stride", () => {
  assert.notEqual(runStride, 1.08);
  for (const d of Object.values(rig.directions)) {
    const poses = runPoses(d);
    assert.equal(
      poses.reduce((n, p) => n + p.durationMs, 0),
      500,
    );
    assert(
      poses.some((p) =>
        Object.values(p.supportContacts.contacts).every((c) => !c.support),
      ),
    );
    for (const side of ["left", "right"]) {
      let anchor;
      for (const p of poses) {
        const contact = p.supportContacts.contacts[side];
        if (!contact.support) {
          anchor = undefined;
          continue;
        }
        const ankle = p.supportContacts.world[side + "Ankle"];
        const global = ankle
          .slice(0, 2)
          .map((n, i) => n + d.worldForward[i] * contact.rootDistance);
        anchor ??= global;
        assert(
          distance(anchor, global) < 1e-12,
          "support foot stays at its planted world location",
        );
      }
    }
  }
});
test("run and jump retain physical limb lengths and never bake root travel or jump height", () => {
  for (const d of Object.values(rig.directions))
    for (const p of [...runPoses(d), ...jumpPoses(d)]) {
      assert.deepEqual(p.rootScreenDelta, [0, 0]);
      const w = p.supportContacts.world;
      for (const side of ["left", "right"])
        for (const [a, b, length] of [
          ["Hip", "Knee", 0.3187701178],
          ["Knee", "Ankle", 0.3060520193],
          ["Shoulder", "Elbow", 0.252],
          ["Elbow", "Wrist", 0.214],
        ])
          assert(Math.abs(distance(w[side + a], w[side + b]) - length) < 1e-10);
    }
});
test("jump includes crouch, extension, airborne tuck, reaching feet and grounded recovery", () => {
  for (const d of Object.values(rig.directions)) {
    const poses = jumpPoses(d),
      world = poses.map((p) => p.supportContacts.world);
    assert.equal(
      poses.reduce((n, p) => n + p.durationMs, 0),
      2000,
    );
    assert(world[0].pelvis[2] < world[2].pelvis[2]);
    assert(world[3].leftAnkle[2] > world[2].leftAnkle[2]);
    assert(world[6].pelvis[2] < world[5].pelvis[2]);
    for (const i of [0, 6, 7])
      for (const contact of Object.values(poses[i].supportContacts.contacts))
        assert.equal(contact.soleHeight, 0);
  }
});
test("climb alternates independent contacts in ascent and descent without raster mirroring", async () => {
  const { climbPoses, climbStride } = await import("./climb.mjs");
  for (const d of Object.values(rig.directions)) {
    const poses = climbPoses(d);
    assert.equal(poses.length, 24);
    for (const offset of [0, 8])
      for (const side of ["left", "right"]) {
        let handAnchor, footAnchor;
        for (const pose of poses.slice(offset, offset + 8)) {
          const c = pose.supportContacts.contacts[side];
          if (!c.support) {
            handAnchor = footAnchor = undefined;
            continue;
          }
          const hand = c.handHeight + c.rootHeight,
            foot = c.footHeight + c.rootHeight;
          handAnchor ??= hand;
          footAnchor ??= foot;
          assert(Math.abs(hand - handAnchor) < 1e-12);
          assert(Math.abs(foot - footAnchor) < 1e-12);
        }
      }
    assert.equal(climbStride, 0.5);
    assert(
      poses[23].supportContacts.world.pelvis[2] >
        poses[16].supportContacts.world.pelvis[2],
    );
  }
});
test("climb reuses the successful independent forearms and stowed staff registrations", async () => {
  const { loadClimbRig } = await import("./rig.mjs");
  const config = await loadClimbRig([
    "NE",
    "SW",
    "E",
    "W",
    "N",
    "S",
    "NW",
    "SE",
  ]);
  for (const direction of Object.values(config.directions)) {
    assert(!direction.attachments.some((a) => a.id === "left-forearm-hand"));
    assert(
      direction.attachments.some(
        (a) => a.id === "left-forearm" && a.joint === "leftElbow",
      ),
    );
    assert(
      direction.attachments.some(
        (a) => a.id === "right-forearm" && a.joint === "rightElbow",
      ),
    );
    assert.equal(
      direction.attachments.find((a) => a.id === "staff").joint,
      "pelvis",
    );
    assert(
      !direction.attachments.some((a) => a.layer.startsWith("cargo-bundle")),
    );
  }
});

test("south cleanup preserves the seven accepted headings and exposes the left palm above both sleeves", async () => {
  const clean = await loadRunJumpRig(Object.keys(rig.directions));
  for (const name of Object.keys(rig.directions).filter(name => name !== "S"))
    assert.deepEqual(clean.directions[name], rig.directions[name]);
  const south = clean.directions.S;
  assert(!south.attachments.some(a => a.id === "left-forearm-hand"));
  const hand = south.attachments.find(a => a.id === "left-natural-hand");
  assert.equal(hand.joint, "leftWrist");
  assert.equal(hand.angleJoint, "leftElbow");
  assert.equal(hand.layer, "hand-left-front");
  assert.equal(hand.variant, undefined);
  assert(clean.layerOrderByDirection.S.indexOf(hand.layer) > clean.layerOrderByDirection.S.indexOf("outfit-warden-front"));
  assert(Object.values(clean.previewLooks).every(layers => layers.includes(hand.layer)));
  for (const side of ["left", "right"])
    assert(south.attachments.find(a => a.id === side + "-thigh").image.includes("south-limb-cleanup/"));
});

test("south airborne sole readback follows the same adjusted ankle targets as the rendered joints", () => {
  const poses = jumpPoses(rig.directions.S);
  for (const frame of [3, 4]) for (const side of ["left", "right"]) {
    const { world, contacts } = poses[frame].supportContacts;
    assert.equal(contacts[side].soleHeight, world[side + "Ankle"][2] - .11);
    assert.equal(contacts[side].support, false);
  }
});
