export type GridPoint = { x: number; y: number };
export const tileWidth = 128;
export const tileHeight = 64;
export function project(x: number, y: number, z = 0) {
  return { x: (x-y)*tileWidth/2, y: (x+y)*tileHeight/2-z*32 };
}
export function inverse(x: number, y: number, z = 0): GridPoint {
  const a=x/(tileWidth/2), b=(y+z*32)/(tileHeight/2);
  return {x:(a+b)/2,y:(b-a)/2};
}
export const diamond = (x:number,y:number) => [x,y-32,x+64,y,x,y+32,x-64,y];
export function containsTile(point:GridPoint, tile:GridPoint) {
  const p=project(tile.x,tile.y);
  return Math.abs(point.x-p.x)/64+Math.abs(point.y-p.y)/32<=1;
}
