import { actorSlot } from '../../client/src/mapLayout';
import {test,expect} from '@playwright/test';
import {project,inverse,containsTile} from '../../client/src/isoGeometry';
import {mapLayout} from '../../client/src/mapLayout';
import {fitMap} from '../../client/src/mapCamera';
import {CameraController} from '../../client/src/cameraController';
import {ActorMotion} from '../../client/src/actorMotion';
test('isometric geometry, legal corridors and continuous paths',()=>{
 for(let x=-9;x<=9;x++)for(let y=-9;y<=9;y++){const p=project(x,y);expect(inverse(p.x,p.y)).toEqual({x,y});expect(containsTile(p,{x,y})).toBe(true);}
 expect(containsTile({x:65,y:0},{x:0,y:0})).toBe(false);
 const rooms=[[0,0],[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]].map(([q,r],i)=>({q,r,id:'room-'+i})) as Parameters<typeof mapLayout>[0];
 const layout=mapLayout(rooms);expect(layout.links).toHaveLength(12);
 for(const link of layout.links)for(let i=1;i<link.points.length;i++)expect(Math.abs(link.points[i].x-link.points[i-1].x)+Math.abs(link.points[i].y-link.points[i-1].y)).toBe(1);
 expect(fitMap({minX:-400,minY:-200,maxX:400,maxY:200},360,800).scale*800).toBeLessThanOrEqual(288);
 const controller=new CameraController();controller.focus({kind:'actor',id:'a',revision:1});const bounds={minX:-500,minY:-500,maxX:500,maxY:500};const camera=controller.apply(bounds,400,800,1,()=>({x:100,y:100}),()=>undefined);controller.pan(30,20,400,800);const moved=controller.apply(bounds,400,800,1,()=>({x:900,y:900}),()=>undefined);expect(moved.x).toBeCloseTo(camera.x+30);controller.focus({kind:'actor',id:'a',revision:2});expect(controller.mode.kind).toBe('actor');
 const motion=new ActorMotion({x:0,y:0});motion.move({x:100,y:100},0,false,[{x:100,y:0}]);expect(motion.sample(225)).toMatchObject({x:100,y:0,moving:true});expect(motion.sample(450)).toMatchObject({x:100,y:100,moving:false,direction:'S'});const late=new ActorMotion({x:0,y:0});late.move({x:100,y:100},0,false,[{x:100,y:0}]);expect(late.sample(600).direction).toBe(motion.sample(600).direction);
});

test('overview pan keeps scale and zoom buttons affect overview',()=>{
 const c=new CameraController(),bounds={minX:-1000,minY:-600,maxX:1000,maxY:600};
 const apply=(zoom=1)=>c.apply(bounds,1200,800,zoom,()=>undefined,()=>undefined);
 const before={...apply()};c.pan(100,30,1200,800);const after=apply();
 expect(after.scale).toBe(before.scale);expect(after.x).toBeCloseTo(before.x+100);expect(after.y).toBeCloseTo(before.y+30);
 c.overview();const base=apply().scale;expect(apply(1.1).scale).toBeCloseTo(base*1.1);
});

test('real tile stage preserves camera picking and movement',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 const session=await page.request.post('/api/sessions',{data:{mode:'training'}}).then(r=>r.json());
 await page.addInitScript(a=>sessionStorage.setItem('arena-session',JSON.stringify(a)),session);await page.goto('/');
 const map=page.locator('.pixi-map').first();await expect(map.locator('canvas')).toBeVisible();await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('arena-session'))).not.toBeNull();await expect.poll(()=>map.getAttribute('data-actors')).toBeTruthy();
 const data=await page.evaluate(async()=>{const a=JSON.parse(sessionStorage.getItem('arena-session')!);const headers={Authorization:'Bearer '+a.token,'Content-Type':'application/json'};await fetch(`/api/sessions/${a.sessionId}/commands`,{method:'POST',headers,body:JSON.stringify({type:'reset'})});const state=await fetch(`/api/sessions/${a.sessionId}/state`,{headers}).then(r=>r.json());return {a,state};});
 await page.getByRole('button',{name:'全图总览',exact:true}).click();
 const initialCamera=JSON.parse((await map.getAttribute('data-camera'))!);await page.getByRole('button',{name:'放大地图',exact:true}).click();await expect.poll(async()=>JSON.parse((await map.getAttribute('data-camera'))!).scale).toBeGreaterThan(initialCamera.scale);
 const destination=data.state.rooms.find((r:{q:number;r:number})=>r.q===1&&r.r===0);const point=project(8,0);
 const clickRoom=async()=>{const box=await map.boundingBox();const camera=JSON.parse((await map.getAttribute('data-camera'))!);await page.mouse.click(box!.x+camera.x+point.x*camera.scale,box!.y+camera.y+point.y*camera.scale);};
 await clickRoom();await expect(page.locator('body')).toContainText(destination.name);
 await page.evaluate(async({a,destination})=>{const response=await fetch(`/api/sessions/${a.sessionId}/commands`,{method:'POST',headers:{Authorization:'Bearer '+a.token,'Content-Type':'application/json'},body:JSON.stringify({type:'move',actorId:'p1-scout',roomId:destination.id})});if(!response.ok)throw new Error(await response.text());},{a:data.a,destination});
 await page.getByRole('button',{name:'开始远征',exact:true}).click();
 await expect.poll(async()=>JSON.parse((await map.getAttribute('data-actors'))!).find((a:{id:string})=>a.id==='p1-scout')?.moving,{intervals:[10,20]}).toBe(true);
 await expect.poll(async()=>JSON.parse((await map.getAttribute('data-actors'))!).find((a:{id:string})=>a.id==='p1-scout')?.travel,{timeout:15000}).toBeNull();
 const before=JSON.parse((await map.getAttribute('data-camera'))!);const rect=await map.boundingBox();await page.mouse.move(rect!.x+rect!.width*.5,rect!.y+rect!.height*.6);await page.mouse.down();await page.mouse.move(rect!.x+rect!.width*.5+60,rect!.y+rect!.height*.6+30,{steps:6});await page.mouse.up();await expect.poll(async()=>Math.round(JSON.parse((await map.getAttribute('data-camera'))!).x-before.x)).toBe(60);expect(JSON.parse((await map.getAttribute('data-camera'))!).scale).toBe(before.scale);
 expect(requests.some(r=>r.includes('/assets/tiles/'))).toBe(true);expect(requests.some(r=>r.includes('library-map.png'))).toBe(false);expect(errors).toEqual([]);
});

test('two clients share authoritative positions and select actors through the camera',async({browser})=>{
 const one=await browser.newContext(),two=await browser.newContext();const host=await one.newPage(),guest=await two.newPage();
 await host.goto('/');await host.getByRole('button',{name:/或加入联机赛局/}).click();await host.getByRole('button',{name:/创建联机/}).click();
 await expect.poll(()=>host.evaluate(()=>sessionStorage.getItem('arena-session'))).not.toBeNull();const auth=await host.evaluate(()=>JSON.parse(sessionStorage.getItem('arena-session')!));
 const pose=async(page:typeof host)=>JSON.parse((await page.locator('.pixi-map').first().getAttribute('data-actors'))||'[]').find((a:{id:string})=>a.id==='p1-scout');
 await expect.poll(async()=>Boolean(await pose(host))).toBe(true);
 await guest.goto('/');await guest.getByRole('button',{name:/或加入联机赛局/}).click();await guest.getByLabel('使用赛局编号加入').fill(auth.sessionId);await guest.getByRole('button',{name:'加入赛局',exact:true}).click();
 const guestPortrait=guest.locator('.dock-squad img[alt="同相机角色预览"]').first();
 await expect(guestPortrait).toBeVisible();
 await expect.poll(()=>guestPortrait.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
 await expect.poll(async()=>Boolean(await pose(guest))).toBe(true);
 await expect.poll(async()=>{const a=await pose(host),b=await pose(guest);return !!a&&!!b&&a.x===b.x&&a.y===b.y;}).toBe(true);
 await host.getByRole('button',{name:'全图总览',exact:true}).click();
 await host.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 const map=host.locator('.pixi-map').first(),box=await map.boundingBox(),camera=JSON.parse((await map.getAttribute('data-camera'))!),actor=await pose(host);
 await host.mouse.click(box!.x+camera.x+actor.x*camera.scale,box!.y+camera.y+(actor.y-70)*camera.scale);
 await expect(host.getByLabel('选中角色操作')).toContainText('巡书使');await one.close();await two.close();
});
