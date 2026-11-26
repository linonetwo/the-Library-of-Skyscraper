declare const observationHandle: unique symbol;
declare const channelHandle: unique symbol;
export interface ChantInput { readonly actorId: string; readonly targetId: string; readonly tick: number }
/** Values are from this invocation's authorized snapshot; the host owns the product identity. */
export interface ChantObservation {
  readonly enemyId: string; readonly roomId: string | null; readonly hp: number;
  readonly [observationHandle]: true;
}
export interface ChantChannel { readonly [channelHandle]: true }
export interface ChantApi {
  observe(): ChantObservation;
  channel(observation: ChantObservation): ChantChannel;
  seal(channel: ChantChannel): void;
}
export type ChantInkStrike = (input: ChantInput, api: ChantApi) => void;
