import { openMenu, closeOverlay } from './hud-helpers';
import { test, expect } from "@playwright/test";
import { facing } from "../../client/src/actorMotion";
import { project } from "../../client/src/isoGeometry";
import { mapLayout, actorSlot } from "../../client/src/mapLayout";
import { floorPoint } from "../../client/src/libraryLayout";
import { animationLayers } from "../../client/src/walkLayers";

test("idle atlas covers every appearance and paused inspection stays fixed", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  for (const outfit of ["scholar", "warden"] as const)
    for (const hair of ["ivory", "midnight"] as const)
      for (const weapon of [false, true])
        for (const layer of animationLayers("idle", { outfit, hair, weapon })) {
          const response = await request.get(`/assets/animation/idle-${layer}.json`);
          expect(response.ok()).toBeTruthy();
          const atlas = await response.json();
          for (const direction of ["S", "SW", "W", "NW", "N", "NE", "E", "SE"])
            for (let frame = 0; frame < 4; frame++)
              expect(atlas.frames[`idle/${layer}/${direction}/0${frame}`].frame.w).toBe(192);
        }
  await page.goto("/animation-lab");
  await expect(page.getByRole("region", { name: "八方向动画预览" }).getByRole("img")).toHaveCount(8);
  await page.getByRole("button", { name: "暂停动画" }).click();
  const frame = await page.getByLabel("当前帧").innerText();
  await page.waitForTimeout(400);
  await expect(page.getByLabel("当前帧")).toHaveText(frame);
  for (const outfit of ["scholar", "warden"]) {
    await page.getByLabel("动画衣装").selectOption(outfit);
    await expect(page.getByRole("region", { name: "八方向动画预览" }).locator(".animated-outfit")).toHaveCount(8);
    await expect(page.getByRole("region", { name: "八方向动画预览" }).locator(".animated-outfit").first()).toHaveAttribute("style", new RegExp(`idle-${outfit === "scholar" ? "outfit-scholar" : "outfit-warden"}`));
  }
  await page.getByRole("button", { name: "下一帧" }).click();
  await expect(page.getByLabel("当前帧")).not.toHaveText(frame);
  expect(errors).toEqual([]);
});

test("two clients see equipped actor idle walk and stop", async ({ browser }) => {
 const a = await browser.newContext(), b = await browser.newContext();
 const host = await a.newPage(), guest = await b.newPage();
 await host.goto('/');
 await openMenu(host, '联机大厅');
 await host.getByRole('button',{name:/创建联机/}).click();
 await expect.poll(()=>host.evaluate(()=>sessionStorage.getItem('arena-session'))).not.toBeNull();
 const auth=await host.evaluate(()=>JSON.parse(sessionStorage.getItem('arena-session')!));
 await guest.goto('/');
 await openMenu(guest, '联机大厅');
 await guest.getByLabel('使用赛局编号加入').fill(auth.sessionId);
 await guest.getByRole('button',{name:'加入赛局',exact:true}).click();
 await expect.poll(()=>guest.evaluate(()=>sessionStorage.getItem('arena-session'))).not.toBeNull();
 for (const page of [host, guest]) await page.evaluate(async () => {
  const auth=JSON.parse(sessionStorage.getItem('arena-session')!);
  const response=await fetch(`/api/sessions/${auth.sessionId}/scripts/publish`, {
   method:'POST', headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.token},
   body:JSON.stringify({files:{'main.ts':'export function decide() { return { intents: [] }; }'}}),
  });
  if(!response.ok) throw new Error(await response.text());
 });
 const pose=(page: typeof host)=>page.locator('.pixi-map').getAttribute('data-actors').then(v=>JSON.parse(v||'[]').find((p:{id:string})=>p.id==='p1-scout'));
 await host.getByRole('button', {name:'详情 / 换装',exact:true}).click();
  await host.getByRole('button',{name:'书库守卫',exact:true}).click();
 await expect.poll(async () => {
  const poses=await Promise.all([pose(host),pose(guest)]);
  return poses.every(p=>p?.animation==='idle') && poses[0].x===poses[1].x && poses[0].y===poses[1].y;
 }).toBe(true);
 await Promise.all([host,guest].map(page=>page.evaluate(()=>{
  const map=document.querySelector('.pixi-map')!;
  (window as any).actorMotionEvents=[];
  new MutationObserver(()=>{
   const actor=JSON.parse(map.getAttribute('data-actors')||'[]').find((a:any)=>a.id==='p1-scout');
   if(actor)(window as any).actorMotionEvents.push({moving:actor.moving,animation:actor.animation});
  }).observe(map,{attributes:true,attributeFilter:['data-actors']});
 })));
 const origin = await pose(host);
 const destination = await host.evaluate(async () => {
 const auth=JSON.parse(sessionStorage.getItem('arena-session')!);
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+auth.token};
 const state=await fetch(`/api/sessions/${auth.sessionId}/state`,{headers}).then(r=>r.json());
 const actor=state.actors.find((a:{id:string})=>a.id==='p1-scout');
 const source=state.rooms.find((r:{id:string})=>r.id===actor.roomId);
 const room=state.rooms.find((r:{id:string;q:number;r:number})=>
  Math.max(Math.abs(r.q-source.q),Math.abs(r.r-source.r),Math.abs(r.q+r.r-source.q-source.r))===1);
 const response=await fetch(`/api/sessions/${auth.sessionId}/commands`,{method:'POST',headers,body:JSON.stringify({type:'move',actorId:actor.id,roomId:room.id})});
 if(!response.ok) throw new Error(await response.text());
 const result=await response.json();
 const group=result.actors.filter((a:{roomId:string})=>a.roomId===room.id);
 return {room, source, rooms:state.rooms, index:group.sort((a:{id:string},b:{id:string})=>a.id.localeCompare(b.id)).findIndex((a:{id:string})=>a.id===actor.id)};
 });
 const targetPoint = actorSlot(destination.room, destination.index);
 const link=mapLayout(destination.rooms).links.find(l=>(l.from===destination.source.id&&l.to===destination.room.id)||(l.to===destination.source.id&&l.from===destination.room.id))!;
 const last=(link.from===destination.source.id?link.points:[...link.points].reverse()).at(-1)!;
 const expectedDirection = facing(project(last.x,last.y), targetPoint);
 await Promise.all([host,guest].map(page=>expect.poll(()=>page.evaluate(()=>{const events=(window as any).actorMotionEvents;const moving=events.findIndex((e:any)=>e.moving&&e.animation==='walk');return moving>=0&&events.slice(moving+1).some((e:any)=>!e.moving&&e.animation==='idle');})).toBe(true)));
 const target = actorSlot(destination.room, destination.index);
 const stopped = {x:target.x, y:target.y};
 await expect.poll(async () => {
  const poses = await Promise.all([pose(host), pose(guest)]);
  return poses.map(p => ({animation:p?.animation, x:Math.round(p?.x*1000)/1000, y:Math.round(p?.y*1000)/1000, direction:p?.direction}));
 }).toEqual([0,1].map(() => ({animation:'idle', x:Math.round(stopped.x*1000)/1000,
  y:Math.round(stopped.y*1000)/1000, direction: expectedDirection})));

 await a.close(); await b.close();
});
