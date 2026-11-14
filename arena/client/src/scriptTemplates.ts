import gather from "../../script-sdk/examples/gather.ts?raw";
import defend from "../../script-sdk/examples/defend.ts?raw";
import explore from "../../script-sdk/examples/explore.ts?raw";
import shared from "../../script-sdk/examples/shared.ts?raw";
import memoryGather from "../../script-sdk/examples/memory-gather.ts?raw";
import type { RuleSourceProject } from "./scriptTypes";

export const recallSource = `import type { RuleContext, RuleDecisionResult } from "@skyscraper/arena-script-sdk";

// 将小队召回中庭；修改 roomId 可以改变目标。
export function decide(ctx: RuleContext): RuleDecisionResult {
  return {
    intents: ctx.squad.actors
      .filter(actor => actor.roomId !== "room-0")
      .map(actor => ({
        type: "move",
        actorId: actor.id,
        roomId: "room-0",
        priority: 50,
        reason: "回到中庭集结",
      })),
  };
}
`;

// Keep the SDK examples as the source of truth; expand their shared module for editing.
const helpers = shared.replace("'../src/index.ts'", "'@skyscraper/arena-script-sdk'");
const standalone = (source: string) => `${helpers}\n${source
  .replace(/^import type .*;\n/m, "")
  .replace(/^import .* from '\.\/shared.ts';\n/m, "")}`;
const sdkImports = (source: string) => source.replaceAll("'../src/index.ts'", "'@skyscraper/arena-script-sdk'");
const singleFile = (source: string): RuleSourceProject => ({ files: { "main.ts": source } });
export const scriptTemplates: Record<string, { name: string; project: RuleSourceProject }> = {
  recall: { name: "召回中庭", project: singleFile(recallSource) },
  gather: { name: "资源优先", project: singleFile(standalone(gather)) },
  defend: { name: "守卫书库", project: singleFile(standalone(defend)) },
  explore: { name: "深入探索", project: singleFile(standalone(explore)) },
  "memory-gather": { name: "记忆采集计划", project: {
    entry: "main.ts", files: { "main.ts": sdkImports(memoryGather), "gather.ts": sdkImports(gather), "shared.ts": sdkImports(shared) },
  } },
};
