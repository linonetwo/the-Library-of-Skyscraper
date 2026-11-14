import { test, expect } from "@playwright/test";
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
  await expect(page.getByRole("img")).toHaveCount(8);
  await page.getByRole("button", { name: "暂停动画" }).click();
  const frame = await page.getByLabel("当前帧").innerText();
  await page.waitForTimeout(400);
  await expect(page.getByLabel("当前帧")).toHaveText(frame);
  for (const outfit of ["scholar", "warden"]) {
    await page.getByLabel("动画衣装").selectOption(outfit);
    await expect(page.locator(".animated-outfit")).toHaveCount(8);
    await expect(page.locator(".animated-outfit").first()).toHaveAttribute("style", new RegExp(`idle-${outfit === "scholar" ? "outfit-scholar" : "outfit-warden"}`));
  }
  await page.getByRole("button", { name: "下一帧" }).click();
  await expect(page.getByLabel("当前帧")).not.toHaveText(frame);
  expect(errors).toEqual([]);
});

test("two clients see equipped actor idle walk and stop", async ({ browser }) => {
 const a = await browser.newContext(), b = await browser.newContext();
 const host = await a.newPage(), guest = await b.newPage();
 await host.goto('/');
 await host.getByRole('button',{name:'联机大厅',exact:true}).click();
 await host.getByRole('button',{name:/创建联机/}).click();
 await expect.poll(()=>host.evaluate(()=>sessionStorage.getItem('arena-session'))).not.toBeNull();
 const auth=await host.evaluate(()=>JSON.parse(sessionStorage.getItem('arena-session')!));
 await guest.goto('/');
 await guest.getByRole('button',{name:'联机大厅',exact:true}).click();
 await guest.getByLabel('使用赛局编号加入').fill(auth.sessionId);
 await guest.getByRole('button',{name:'加入赛局',exact:true}).click();
 const pose=(page: typeof host)=>page.locator('.pixi-map').getAttribute('data-actors').then(v=>JSON.parse(v||'[]').find((p:{id:string})=>p.id==='p1-scout'));
 await host.getByRole('button',{name:'书库守卫',exact:true}).click();
 for(const page of [host,guest]) await expect.poll(async()=>(await pose(page))?.animation).toBe('idle');
 await host.evaluate(async () => {
 const auth=JSON.parse(sessionStorage.getItem('arena-session')!);
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+auth.token};
 const state=await fetch(`/api/sessions/${auth.sessionId}/state`,{headers}).then(r=>r.json());
 const actor=state.actors.find((a:{id:string})=>a.id==='p1-scout');
 const room=state.rooms.find((r:{id:string})=>r.id!==actor.roomId);
 const response=await fetch(`/api/sessions/${auth.sessionId}/commands`,{method:'POST',headers,body:JSON.stringify({type:'move',actorId:actor.id,roomId:room.id})});
 if(!response.ok) throw new Error(await response.text());
 });
 await Promise.all([host,guest].map(page=>expect.poll(async()=>(await pose(page))?.moving,{intervals:[10,20]}).toBe(true)));
 for(const page of [host,guest]) await expect.poll(async()=>(await pose(page))?.animation).toBe('idle');
 expect((await pose(host)).direction).toBe((await pose(guest)).direction);
 await a.close(); await b.close();
});
