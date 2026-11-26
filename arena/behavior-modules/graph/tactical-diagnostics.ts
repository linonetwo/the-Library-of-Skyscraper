import type {TacticalModule} from './tactical-types';
export function validTacticalConfig(module:TacticalModule):boolean {
 const ref=module.config?.target;
 const id=(value:unknown)=>typeof value==='string'&&value.trim().length>0;
 if(!ref)return false;
 switch(module.kind){
  case 'claim':return ref.type==='controlPoint'&&id(ref.roomId);
  case 'repair':return (ref.type==='ownBuilding'&&id(ref.buildingId))||(ref.type==='ownBuildingInRoom'&&id(ref.roomId)&&ref.select==='mostDamaged');
  case 'attack':case 'cast':return ((ref.type==='enemy'&&id(ref.enemyId))||(ref.type==='enemyInRoom'&&id(ref.roomId)&&ref.select==='lowestHp'))&&(module.kind!=='cast'||module.config.skillId==='ink-strike');
 }
}
