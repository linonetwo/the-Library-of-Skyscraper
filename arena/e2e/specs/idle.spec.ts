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

test("two clients see equipped actor follow the same authoritative travel", async ({ browser,request }) => {
 const hostAuth=await request.post('/api/sessions',{data:{mode:'online'}}).then(r=>r.json());
 const guestAuth=await request.post(`/api/sessions/${hostAuth.sessionId}/join`,{data:{}}).then(r=>r.json());
 const post=(command:object)=>request.post(`/api/sessions/${hostAuth.sessionId}/commands`,{headers:{Authorization:'Bearer '+hostAuth.token},data:command});
 await post({type:'equip',actorId:'p1-gatherer',appearance:{outfit:'warden',hair:'midnight',weapon:false}});
 const contexts=await Promise.all([browser.newContext(),browser.newContext()]);const pages=await Promise.all(contexts.map(c=>c.newPage()));
 await Promise.all(pages.map(async(p,i)=>{await p.addInitScript(a=>sessionStorage.setItem('arena-session',JSON.stringify(a)),[hostAuth,guestAuth][i]);await p.goto('/');await expect(p.locator('canvas')).toBeVisible();}));
 const pose=(p:typeof pages[0])=>p.locator('.pixi-map').getAttribute('data-actors').then(v=>JSON.parse(v||'[]').find((a:any)=>a.id==='p1-gatherer'));
 const response=await post({type:'move',actorId:'p1-gatherer',roomId:'room-1'});expect(response.ok()).toBe(true);
 const result=await response.json();const end=result.actors.find((a:any)=>a.id==='p1-gatherer').travel.path.at(-1);const target=project(end.x,end.y);
 await expect.poll(async()=>(await pose(pages[0]))?.travel?.distanceMilli).toBeGreaterThan(0);
 await expect.poll(async()=>{const values=await Promise.all(pages.map(pose));return values.every(p=>p&&p.travel===null);},{timeout:12000}).toBe(true);
 await expect.poll(async()=>{const values=await Promise.all(pages.map(pose));return values.every(p=>!p.moving&&Math.abs(p.x-target.x)<.001&&Math.abs(p.y-target.y)<.001&&p.textures.some((key:string)=>key.includes('outfit-warden')));}).toBe(true);
 await Promise.all(contexts.map(c=>c.close()));
});
