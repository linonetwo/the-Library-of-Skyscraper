import { project } from './isoGeometry';
import { roomCenter } from './mapLayout';
/** Protocol room topology mapped onto the common isometric world grid. */
export function floorPoint(q:number,r:number) { const p=roomCenter(q,r);return project(p.x,p.y); }
