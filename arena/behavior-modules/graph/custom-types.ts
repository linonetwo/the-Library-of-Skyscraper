import type { ActorRole } from '../types';
import type { RoomRef, OwnRoleRef } from './composition-types';
export type CustomParameter = number | boolean | RoomRef | OwnRoleRef;
export type CustomField = { key: string; label: string } & (
  | { type: 'number'; default: number; integer?: boolean; min?: number; max?: number }
  | { type: 'boolean'; default: boolean }
  | { type: 'roomRef'; default: RoomRef }
  | { type: 'ownRoleRef'; default: OwnRoleRef }
);
export interface CustomModuleDraft {
  definitionId: string; name: string; fields: CustomField[];
  exits: { key: string; label: string }[]; source: string;
}
export interface CustomModuleDefinition extends CustomModuleDraft { revisionId: string }
export interface CustomModuleBinding {
  moduleId: string; kind: 'custom'; definitionId: string; revisionId: string;
  config: Record<string, CustomParameter>; enabled: boolean; priority: number; roleFilter?: ActorRole[];
}
export interface CustomModuleDiagnostic { key?: string; code: string; message: string }
