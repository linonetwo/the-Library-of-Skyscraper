import type { CompositionModule, RoomRef } from './composition-types';
export function validCompositionConfig(module:CompositionModule):boolean {
 const room=(ref:RoomRef)=>ref?.type==='room'&&typeof ref.roomId==='string'&&ref.roomId.trim().length>0;
 const nonnegative=(value:number)=>Number.isInteger(value)&&value>=0;
 switch(module.kind){
  case 'scout':return room(module.config.target)&&nonnegative(module.config.maxEnemyHp)&&nonnegative(module.config.reportIntervalTicks);
  case 'patrol':return module.config.rooms.length>0&&module.config.rooms.every(room)&&nonnegative(module.config.dwellTicks);
  case 'escort':return module.config.target?.type==='ownRole'&&['gatherer','guard','scout'].includes(module.config.target.role)&&nonnegative(module.config.minCargo);
 }
}
