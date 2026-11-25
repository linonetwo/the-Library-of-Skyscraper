const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { EventEmitter, once } = require("node:events");
const { spawn } = require("node:child_process");
const { waitReady, stopChild } = require("./server.cjs");

function child() {
  const proc = new EventEmitter();
  proc.exitCode = proc.signalCode = null;
  proc.kill = (signal) => {
    proc.signalCode = signal;
    queueMicrotask(() => proc.emit("exit", null, signal));
    return true;
  };
  return proc;
}
async function status(t, handler) {
  const server = http.createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}/status`;
}

test("late /status readiness keeps the same child after one slow-start warning", async t => {
  let available = false, warnings = 0, probes = 0;
  const statusUrl = await status(t, (req, res) => {
    probes++;
    res.writeHead(available ? 200 : 503).end();
  });
  const proc = child();
  const waiting = waitReady(proc, {
    statusUrl, slowAfterMs: 10, pollMs: 5,
    onSlow: () => { warnings++; },
  });
  await new Promise(resolve => setTimeout(resolve, 45));
  assert.equal(warnings, 1);
  available = true;
  await waiting;
  assert(probes >= 2);
  assert.equal(warnings, 1);
  assert.equal(proc.signalCode, null);
  assert.equal(proc.listenerCount("exit"), 0);
});

test("fast readiness and a normal source-change restart both complete", async t => {
  const statusUrl = await status(t, (req, res) => res.writeHead(200).end());
  const options = { statusUrl, slowAfterMs: 1000, onSlow: () => assert.fail("fast startup warned") };
  const first = child();
  await waitReady(first, options);
  await stopChild(first);
  assert.equal(first.signalCode, "SIGTERM");
  const replacement = child();
  await waitReady(replacement, options);
  await stopChild(replacement);
});

test("an already signal-exited real child does not await a past exit on restart", { timeout: 3000 }, async t => {
  const proc = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
  t.after(() => proc.kill("SIGTERM"));
  const exited = once(proc, "exit");
  proc.kill("SIGTERM");
  await exited;
  assert.equal(proc.exitCode, null);
  assert.equal(proc.signalCode, "SIGTERM");
  await stopChild(proc);
  const statusUrl = await status(t, (req, res) => res.writeHead(200).end());
  await waitReady(child(), { statusUrl });
});

test("stop cancels a pending readiness request and its retry lifecycle", async t => {
  let probes = 0;
  const statusUrl = await status(t, (req, res) => { probes++; res.writeHead(503).end(); });
  const proc = child();
  const controller = new AbortController();
  const waiting = waitReady(proc, { statusUrl, signal: controller.signal, pollMs: 5 });
  const rejected = assert.rejects(waiting, /TiddlyWiki stopped/);
  controller.abort();
  await rejected;
  await stopChild(proc);
  const afterStop = probes;
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(probes, afterStop);
  assert.equal(proc.listenerCount("exit"), 0);
});

test("actual spawn failure and startup signal exit finish readiness promptly", { timeout: 3000 }, async () => {
  const failed = spawn("/nonexistent/wiki-readiness-test", [], { stdio: "ignore" });
  await assert.rejects(waitReady(failed), { code: "ENOENT" });
  await stopChild(failed);
  const proc = child();
  const waiting = assert.rejects(waitReady(proc), /TiddlyWiki stopped/);
  proc.kill("SIGTERM");
  await waiting;
});
