import {test,expect} from '@playwright/test';
import {project,inverse,containsTile} from '../../client/src/isoGeometry';
import {mapLayout} from '../../client/src/mapLayout';
import {fitMap} from '../../client/src/mapCamera';
import {ActorMotion} from '../../client/src/actorMotion';
test('isometric geometry, legal corridors and continuous paths',()=>{
 for(let x=-9;x<=9;x++)for(let y=-9;y<=9;y++){const p=project(x,y);expect(inverse(p.x,p.y)).toEqual({x,y});expect(containsTile(p,{x,y})).toBe(true);}
 expect(containsTile({x:65,y:0},{x:0,y:0})).toBe(false);
 const rooms=[[0,0],[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]].map(([q,r],i)=>({q,r,id:'room-'+i})) as Parameters<typeof mapLayout>[0];
 const layout=mapLayout(rooms);expect(layout.links).toHaveLength(12);
 for(const link of layout.links)for(let i=1;i<link.points.length;i++)expect(Math.abs(link.points[i].x-link.points[i-1].x)+Math.abs(link.points[i].y-link.points[i-1].y)).toBe(1);
 expect(fitMap({minX:-400,minY:-200,maxX:400,maxY:200},360,800).scale*800).toBeLessThanOrEqual(288);
 const motion=new ActorMotion({x:0,y:0});motion.move({x:100,y:100},0,false,[{x:100,y:0}]);expect(motion.sample(225)).toMatchObject({x:100,y:0,moving:true});expect(motion.sample(450)).toMatchObject({x:100,y:100,moving:false});
});
