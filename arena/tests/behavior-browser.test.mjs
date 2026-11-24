import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StdioClientTransport } from "../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js";

test(
  "MCP edits official behavior modules through visible UI and reads real preview traces",
  { skip: process.env.ARENA_BROWSER !== "1", timeout: 120000 },
  async (t) => {
    const client = new Client({ name: "behavior-browser", version: "1" });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [fileURLToPath(new URL("../tools/server.mjs", import.meta.url))],
        env: process.env,
        stderr: "pipe",
      }),
    );
    t.after(() => client.close());
    const call = async (name, args = {}) => {
      const response = await client.callTool({ name, arguments: args });
      assert.notEqual(response.isError, true, response.content[0].text);
      return JSON.parse(response.content[0].text);
    };
    const action = (action) => call("Input.action", { action });
    await call("Page.open");
    t.after(async () => {
      try {
        await call("Page.close");
      } catch {}
    });
    await action({ type: "startTraining" });
    await action({ type: "openBehavior" });
    assert.equal((await call("Page.getState")).behavior.modules.length, 5);
    await action({
      type: "loadBehaviorTemplate",
      template: "first-expedition",
    });
    await action({
      type: "setBehaviorModule",
      moduleId: "retreat",
      priority: 110,
      roles: ["gatherer", "scout"],
      config: { hpThreshold: 25 },
    });
    await action({
      type: "setBehaviorModule",
      moduleId: "haul",
      enabled: true,
      config: { minCargo: 6 },
    });
    await action({
      type: "setBehaviorModule",
      moduleId: "build",
      enabled: false,
      config: { roomId: "room-3", buildingKind: "tower", minMaterials: 30 },
    });
    await action({
      type: "setBehaviorModule",
      moduleId: "defend",
      config: { roomId: "room-3" },
    });
    await action({
      type: "setBehaviorModule",
      moduleId: "gather",
      config: { targetRoomId: "room-1" },
    });
    const beforeInvalid = (await call("Page.getState")).behavior.modules.find(
      (m) => m.moduleId === "haul",
    ).summary;
    const invalid = await client.callTool({
      name: "Input.action",
      arguments: {
        action: {
          type: "setBehaviorModule",
          moduleId: "haul",
          priority: 110,
          config: { hpThreshold: 25 },
        },
      },
    });
    assert.equal(invalid.isError, true);
    assert.match(invalid.content[0].text, /hpThreshold/);
    assert.equal(
      (await call("Page.getState")).behavior.modules.find(
        (m) => m.moduleId === "haul",
      ).summary,
      beforeInvalid,
      "invalid mixed request leaves priority unchanged",
    );
    const edited = (await call("Page.getState")).behavior;
    assert.match(
      edited.modules.find((m) => m.moduleId === "retreat").summary,
      /110.*25/,
    );
    assert.match(
      edited.modules.find((m) => m.moduleId === "haul").summary,
      /6/,
    );
    assert.equal(
      edited.modules.find((m) => m.moduleId === "build").enabled,
      false,
    );
    assert.match(
      edited.modules.find((m) => m.moduleId === "build").summary,
      /塔楼.*30/,
    );
    await action({ type: "previewScript" });
    let preview;
    for (let attempt = 0; attempt < 40; attempt++) {
      preview = (await call("Page.getState")).behavior.traces.find(
        (trace) => trace.source === "试跑当前草稿决策路径",
      );
      if (preview) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert(preview, "real V8 preview renders its decision path");
    assert.match(preview.sourceHash, /^[a-f0-9]{64}$/);
    assert.match(preview.text, /gather.*决策已选择/s);
    await action({ type: "publishScript" });
    assert.match(
      (await call("Page.getState")).behavior.publishedVersion,
      /TS 规则已接管小队/,
    );
    await action({ type: "startExpedition" });
    await action({ type: "pauseExpedition" });
    await action({ type: "stepTraining" });
    await action({ type: "openBehavior" });
    let runtime;
    for (let attempt = 0; attempt < 40; attempt++) {
      runtime = (await call("Page.getState")).behavior.traces.find(
        (trace) => trace.source === "已发布版本运行决策路径",
      );
      if (runtime) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.equal(runtime?.sourceHash, preview.sourceHash);
    await action({ type: "openReplay" });
    await action({
      type: "seekReplay",
      operationIndex: (await call("Page.getState")).replay.maxOperationIndex,
    });
    const replayTrace = (await call("Page.getState")).behavior.traces.find(
      (trace) => trace.source === "回放决策路径",
    );
    assert.equal(replayTrace?.sourceHash, preview.sourceHash);
    await action({ type: "closeReplay" });
    await action({ type: "loadBehaviorTemplate", template: "logistics" });
    assert.match(
      (await call("Page.getState")).behavior.modules.find(
        (m) => m.moduleId === "haul",
      ).summary,
      /藏材≥1/,
    );
    await action({ type: "undoBehaviorReplacement" });
    assert.match(
      (await call("Page.getState")).behavior.modules.find(
        (m) => m.moduleId === "haul",
      ).summary,
      /藏材≥6/,
    );
    await action({ type: "openBehaviorSource", moduleId: "haul" });
    const source = await call("Page.getState");
    assert.match(source.text, /ai-plan.ts/);
    // Workshop must use the same candidate origin, not an unrelated default dev server.
    await action({ type: "openWorkshop" });
    const workshop = await call("Page.getState");
    assert(workshop.workshop);
    assert.equal(
      workshop.url,
      new URL(
        "/animation-lab",
        process.env.ARENA_UI_URL ?? "http://127.0.0.1:5173",
      ).href,
    );
    await action({ type: "returnToArena" });
  },
);
