import { test, expect } from "@playwright/test";
import { ActorMotion, facing } from "../../client/src/actorMotion";
import { floorPoint } from "../../client/src/libraryLayout";

test("eight facings and continuous motion across new destinations", () => {
  const directions = [
    [0, 1, "S"], [-1, 1, "SW"], [-1, 0, "W"], [-1, -1, "NW"],
    [0, -1, "N"], [1, -1, "NE"], [1, 0, "E"], [1, 1, "SE"],
  ] as const;
  for (const [x, y, direction] of directions)
    expect(facing({ x: 0, y: 0 }, { x, y })).toBe(direction);
  const motion = new ActorMotion({ x: 0, y: 0 }, 400);
  motion.move({ x: 100, y: 0 }, 1000);
  expect(motion.sample(1200)).toMatchObject({ x: 50, y: 0, moving: true, direction: "E", frame: 2 });
  motion.move({ x: 50, y: 100 }, 1200);
  expect(motion.sample(1400)).toMatchObject({ x: 50, y: 50, direction: "SW" });
  expect(motion.sample(1600)).toMatchObject({ x: 50, y: 100, moving: false, frame: 2 });
  motion.move({ x: 0, y: 0 }, 1700, true);
  expect(motion.sample(1700)).toMatchObject({ x: 0, y: 0, moving: false });
});

test("battlefield paper doll walks between authoritative room destinations", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "开启训练远征" }).click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  const poses = () => page.locator(".pixi-map").getAttribute("data-actors")
    .then(value => JSON.parse(value || "[]") as {
      id: string; x: number; y: number; moving: boolean; animation: string; direction: string;
    }[]);
  await expect.poll(async () => (await poses()).filter(p => p.animation === "idle").length)
    .toBe(3);
  await page.evaluate(async () => {
    const session = JSON.parse(sessionStorage.getItem("arena-session")!);
    const send = (command: object) => fetch(`/api/sessions/${session.sessionId}/commands`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
      body: JSON.stringify(command),
    });
    await send({ type: "reset" });
    await send({ type: "equip", actorId: "p1-scout",
      appearance: { outfit: "scholar", hair: "ivory", weapon: false } });
  });
  await expect(page.getByText("TICK 0000", { exact: true })).toBeVisible();
  await expect.poll(async () => (await poses()).find(p => p.id === "p1-scout"))
    .toMatchObject({ x: 39, y: floorPoint(0, 0).y + 4, moving: false });
  await expect.poll(async () => (await poses()).find(p => p.id === "p1-scout")?.animation)
    .toBe("idle");
  await page.getByRole("button", { name: "单步", exact: true }).click();
  await expect.poll(async () => (await poses()).find(p => p.id === "p1-scout")?.moving,
    { intervals: [20, 20, 30] }).toBe(true);
  await expect.poll(async () => (await poses()).find(p => p.id === "p1-scout")?.moving).toBe(false);
  expect(errors).toEqual([]);
});

test("idle samples are deterministic and retain final facing", () => {
 const motion = new ActorMotion({x:0,y:0});
 expect(new Set([0,250,500,750].map(t => motion.sample(t).frame)).size).toBe(4);
 motion.move({x:-100,y:0},1000);
 expect(motion.sample(1100).moving).toBe(true);
 expect(motion.sample(1800)).toMatchObject({moving:false,direction:"W"});
 expect(motion.sample(1800)).toEqual(motion.sample(1800));
});

test("facing follows authoritative segments independently of packet timing", () => {
 for (const delay of [100, 400]) {
  const motion = new ActorMotion({ x: 0, y: 0 });
  motion.move({ x: 100, y: 0 }, 1000);
  const before = motion.sample(1000 + delay);
  motion.move({ x: 80, y: 0 }, 1000 + delay);
  expect(motion.sample(1000 + delay)).toMatchObject({ x: before.x, y: before.y });
  expect(motion.sample(2000)).toMatchObject({ x: 80, y: 0, moving: false, direction: "W" });
 }
});

test("run advances six frames without resetting across continuous destinations", () => {
 const motion=new ActorMotion({x:0,y:0});
 motion.move({x:100,y:0},1000);
 expect(motion.sample(1083).frame).toBe(0);
 expect(motion.sample(1084).frame).toBe(1);
 motion.move({x:200,y:0},1400);
 expect(motion.sample(1450).frame).toBe(5);
 expect(motion.sample(1500).frame).toBe(0);
 expect(motion.sample(1500).moving).toBe(true);
 expect(motion.sample(1850)).toMatchObject({moving:false,direction:"E"});
});
