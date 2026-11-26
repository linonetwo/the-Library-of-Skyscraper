import type {ActorRole} from '../types';
import type {EnemyRef,OwnBuildingRef,ControlPointRef} from '../../script-sdk/src/tactics';
export type TacticalRef = EnemyRef | OwnBuildingRef | ControlPointRef;
export interface TacticalConfig {
 attack: {target:EnemyRef};
 repair: {target:OwnBuildingRef};
 claim: {target:ControlPointRef};
 cast: {target:EnemyRef;skillId:'ink-strike'};
}
export type TacticalModule = {[K in keyof TacticalConfig]:{
 moduleId:string;kind:K;enabled:boolean;priority:number;roleFilter?:ActorRole[];config:TacticalConfig[K];
}}[keyof TacticalConfig];
export const TACTICAL_MODULE_KINDS = ['attack','repair','claim','cast'] as const;
export function isTacticalModule(module:{kind:string}):module is TacticalModule {
 return module.kind==='attack'||module.kind==='repair'||module.kind==='claim'||module.kind==='cast';
}
export function createTacticalModule(kind:'attack',moduleId:string):Extract<TacticalModule,{kind:'attack'}>;
export function createTacticalModule(kind:'repair',moduleId:string):Extract<TacticalModule,{kind:'repair'}>;
export function createTacticalModule(kind:'claim',moduleId:string):Extract<TacticalModule,{kind:'claim'}>;
export function createTacticalModule(kind:'cast',moduleId:string):Extract<TacticalModule,{kind:'cast'}>;
export function createTacticalModule(kind:keyof TacticalConfig,moduleId:string):TacticalModule;
export function createTacticalModule(kind:keyof TacticalConfig,moduleId:string):TacticalModule {
 const base={moduleId,enabled:true,priority:20};
 switch(kind){
  case 'attack':return {...base,kind,config:{target:{type:'enemyInRoom',roomId:'room-3',select:'lowestHp'}}};
  case 'repair':return {...base,kind,config:{target:{type:'ownBuildingInRoom',roomId:'room-3',select:'mostDamaged'}}};
  case 'claim':return {...base,kind,config:{target:{type:'controlPoint',roomId:'room-2'}}};
  case 'cast':return {...base,kind,config:{target:{type:'enemyInRoom',roomId:'room-3',select:'lowestHp'},skillId:'ink-strike'}};
 }
}
