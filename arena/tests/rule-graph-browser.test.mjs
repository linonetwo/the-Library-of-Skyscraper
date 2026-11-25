import test from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StdioClientTransport } from "../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js";
test(
  "stdio edits the visible rule graph and previews its generated source in V8",
  { skip: process.env.ARENA_BROWSER !== "1", timeout: 120000 },
  async (t) => {
    const client = new Client({ name: "rule-graph-browser", version: "1" });
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
    const graph = async () => (await call("Page.getState")).graph;
    await call("Page.open");
    t.after(async () => {
      try {
        await call("Page.close");
      } catch {}
    });
    await action({ type: "startTraining" });
    await action({ type: "openRuleGraph" });
    await action({ type: "convertBehaviorToRuleGraph" });
    assert.equal((await graph()).visible, true);
    await action({ type: "loadRuleGraphTemplate", template: "logistics" });
    const baseline = await graph();
    assert(baseline.graph.nodes.length > 0);
    await action({ type: "addRuleGraphObject", kind: "condition" });
    const added = (await graph()).selection;
    await action({ type: "setRuleGraphField", label: "阈值", value: 9 });
    assert.equal(
      (await graph()).graph.nodes.find((n) => n.id === added.id).condition
        .value,
      9,
    );
    const target = baseline.graph.nodes[0].id;
    await action({ type: "connectRuleGraph", port: "满足时", target });
    assert.equal(
      (await graph()).graph.nodes.find((n) => n.id === added.id).yes,
      target,
    );
    await action({ type: "connectRuleGraph", port: "满足时", target: "" });
    const disconnected = await graph();
    assert.equal(
      disconnected.graph.nodes.find((n) => n.id === added.id).yes,
      "",
    );
    assert(disconnected.diagnostics.length > 0);
    await action({ type: "selectRuleGraphDiagnostic", index: 0 });
    assert((await graph()).selection);
    await action({ type: "selectRuleGraphObject", ...added });
    await action({ type: "connectRuleGraph", port: "满足时", target });
    const beforeCopy = (await graph()).graph.nodes.length;
    await action({ type: "copyRuleGraphSelection" });
    assert.notEqual((await graph()).selection.id, added.id);
    await action({ type: "deleteRuleGraphSelection" });
    await action({ type: "undoRuleGraph" });
    assert((await graph()).graph.nodes.length > beforeCopy);
    await action({ type: "redoRuleGraph" });
    await action({ type: "selectRuleGraphObject", ...added });
    await action({ type: "renameRuleGraphObject", id: "mcp-condition" });
    assert((await graph()).graph.nodes.some((n) => n.id === "mcp-condition"));
    await action({ type: "loadRuleGraphTemplate", template: "retreat" });
    const valid = await graph();
    const role = valid.graph.roles[0];
    await action({ type: "selectRuleGraphObject", kind: "roles", id: role.id });
    const otherState = valid.graph.states.find(
      (state) => state.id !== role.initialStateId,
    );
    assert(otherState);
    await action({
      type: "connectRuleGraph",
      port: "初始状态",
      target: otherState.id,
    });
    assert.equal(
      (await graph()).graph.roles.find((item) => item.id === role.id)
        .initialStateId,
      otherState.id,
    );
    await action({ type: "undoRuleGraph" });
    assert.equal(
      (await graph()).graph.roles.find((item) => item.id === role.id)
        .initialStateId,
      role.initialStateId,
    );
    await action({
      type: "selectRuleGraphObject",
      kind: "nodes",
      id: valid.graph.nodes[0].id,
    });
    await action({ type: "locateRuleGraphSource" });
    assert.match((await graph()).source, /当前位置 .+\.ts:\d+/);
    await action({ type: "compileScript" });
    await action({ type: "previewScript" });
    let result;
    for (let i = 0; i < 60; i++) {
      result = await graph();
      if (result.results.join("\n").includes("V8")) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.match(result.results.join("\n"), /编译通过/);
    assert.match(result.results.join("\n"), /V8/);
    assert(
      result.traces.some(
        (trace) =>
          trace.source === "当前草稿规则图试跑路径" &&
          /^[a-f0-9]{64}$/.test(trace.sourceHash),
      ),
    );
    if (process.env.ARENA_EVIDENCE_DIR) {
      await action({ type: "openRuleGraph" });
      const directory = process.env.ARENA_EVIDENCE_DIR;
      await mkdir(directory, { recursive: true });
      await writeFile(
        join(directory, "mcp-graph.json"),
        JSON.stringify(await graph(), null, 2),
      );
      const capture = await client.callTool({
        name: "Page.captureScreenshot",
        arguments: {},
      });
      assert.notEqual(capture.isError, true);
      await writeFile(
        join(directory, "mcp-graph.png"),
        Buffer.from(capture.content[0].data, "base64"),
      );
    }
  },
);
