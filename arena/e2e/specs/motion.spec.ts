import { openMenu, closeOverlay, stepTraining } from './hud-helpers';
import { test, expect } from "@playwright/test";
import { ActorMotion, facing } from "../../client/src/actorMotion";


test("eight facings and continuous motion across new destinations", () => {
  const directions = [
    [0, 1, "S"], [-1, 1, "SW"], [-1, 0, "W"], [-1, -1, "NW"],
    [0, -1, "N"], [1, -1, "NE"], [1, 0, "E"], [1, 1, "SE"],
  ] as const;
  for (const [x, y, direction] of directions)
    expect(facing({ x: 0, y: 0 }, { x, y })).toBe(direction);
  const motion = new ActorMotion({ x: 0, y: 0 }, 400);
  motion.move({ x: 100, y: 0 }, 1000);
  expect(motion.sample(1200)).toMatchObject({ x: 50, y: 0, moving: true, direction: "E", frame: 1 });
  motion.move({ x: 50, y: 100 }, 1200);
  expect(motion.sample(1400)).toMatchObject({ x: 50, y: 50, direction: "SW" });
  expect(motion.sample(1600)).toMatchObject({ x: 50, y: 100, moving: false, frame: 2 });
  motion.move({ x: 0, y: 0 }, 1700, true);
  expect(motion.sample(1700)).toMatchObject({ x: 0, y: 0, moving: false });
});

test("battlefield follows authoritative travel and reconnect restores world position", async ({ page }) => {
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'开启训练远征',exact:true}).click();
 await page.getByRole('button',{name:'选择采撷师',exact:true}).click();
 await page.locator('.task-targets button[data-room-id="room-1"]').click();
 await page.getByRole('button',{name:'开始远征',exact:true}).click();
 const poses=()=>page.locator('.pixi-map').getAttribute('data-actors').then(v=>JSON.parse(v||'[]'));
 await expect.poll(async()=>(await poses()).find((a:any)=>a.id==='p1-gatherer')?.travel?.distanceMilli).toBeGreaterThan(0);
 const paused=page.waitForResponse(r=>r.url().endsWith('/commands')&&r.request().postDataJSON()?.type==='pause');
 await page.locator('.game-top').getByRole('button',{name:'暂停',exact:true}).click();await paused;
 await expect(page.getByRole('button',{name:'开始远征',exact:true})).toBeVisible();
 const before=(await poses()).find((a:any)=>a.id==='p1-gatherer');
 expect(before.travel).toBeTruthy();expect(before.travel.distanceMilli).toBeLessThan(before.travel.totalDistanceMilli);
 await page.reload();await expect.poll(async()=>(await poses()).find((a:any)=>a.id==='p1-gatherer')?.worldPosition).toEqual(before.worldPosition);
 const after=(await poses()).find((a:any)=>a.id==='p1-gatherer');
 expect(after.x).toBeCloseTo(64*(before.worldPosition.x-before.worldPosition.y));
 expect(after.y).toBeCloseTo(32*(before.worldPosition.x+before.worldPosition.y));
 expect(after.moving).toBe(false);expect(errors).toEqual([]);
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

test("walk uses authored 125ms frames", () => {
 const motion=new ActorMotion({x:0,y:0});
 motion.move({x:100,y:0},1000);
 expect(motion.sample(1124).frame).toBe(0);
 expect(motion.sample(1125).frame).toBe(1);
});
