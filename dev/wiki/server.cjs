// Development-only proxy: source changes restart TiddlyWiki and notify open tabs.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const wiki = path.resolve(__dirname, "../../wiki");
const clients = new Set();
const uiState =
  /^(?:\$:\/(?:StoryList|HistoryList|state\/|temp\/)|\$__?(?:StoryList|HistoryList|state_|temp_))/;
let child,
  ready = false,
  timer,
  restarting = false,
  pending = false,
  stopping = false,
  readiness;
let revision = 0;
const script = `<script>(()=>{let rev;const e=new EventSource('/__wiki_events');e.onmessage=m=>{const n=JSON.parse(m.data);if(rev!==undefined&&rev!==n){try{sessionStorage.setItem('wiki-open-story',JSON.stringify($tw.wiki.getTiddlerList('$:/StoryList')))}catch(_){}location.reload()}rev=n};const t=setInterval(()=>{if(window.$tw&&$tw.boot&&$tw.rootWidget&&$tw.wiki){clearInterval(t);const s=sessionStorage.getItem('wiki-open-story');if(s){sessionStorage.removeItem('wiki-open-story');$tw.wiki.addTiddler({title:'$:/StoryList',list:JSON.parse(s)})}}},100)})()</script>`;
function announce() {
  for (const res of clients) res.write(`data: ${JSON.stringify(revision)}\n\n`);
}
// One startup keeps observing its own child until ready, stopped, or failed.
function hasExited(proc) {
  return proc.exitCode !== null || proc.signalCode !== null;
}
function waitReady(proc, {
  signal,
  statusUrl = "http://127.0.0.1:3001/status",
  slowAfterMs = 120000,
  pollMs = 250,
  onSlow = () => console.warn("TiddlyWiki startup is slow; still waiting for /status"),
} = {}) {
  return new Promise((resolve, reject) => {
    let retryTimer, request, settled = false;
    const slowTimer = setTimeout(onSlow, slowAfterMs);
    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(slowTimer);
      clearTimeout(retryTimer);
      proc.removeListener("exit", exited);
      proc.removeListener("error", failed);
      signal?.removeEventListener("abort", exited);
      request?.destroy();
      if (error) reject(error);
      else resolve();
    }
    function exited() { finish(Error("TiddlyWiki stopped")); }
    function failed(error) { finish(error); }
    function retry() {
      if (!settled) retryTimer = setTimeout(poll, pollMs);
    }
    function poll() {
      if (settled) return;
      if (hasExited(proc) || signal?.aborted) return exited();
      request = http.get(statusUrl, (res) => {
        res.resume();
        if (hasExited(proc) || signal?.aborted) return exited();
        if (res.statusCode === 200) finish();
        else retry();
      });
      request.on("error", retry);
      request.setTimeout(1000, () => request.destroy());
    }
    proc.once("exit", exited);
    proc.once("error", failed);
    signal?.addEventListener("abort", exited, { once: true });
    poll();
  });
}
function stopChild(proc) {
  if (!proc || hasExited(proc)) return Promise.resolve();
  return new Promise((resolve) => {
    function done() {
      proc.removeListener("exit", done);
      proc.removeListener("error", done);
      resolve();
    }
    proc.once("exit", done);
    proc.once("error", done);
    // signalCode is non-null after signal termination while exitCode stays null.
    if (hasExited(proc)) done();
    else proc.kill("SIGTERM");
  });
}
async function restart() {
  if (stopping) return;
  if (restarting) {
    pending = true;
    return;
  }
  restarting = true;
  ready = false;
  try {
    await stopChild(child);
    if (stopping) return;
    child = spawn(
      process.execPath,
      [
        path.join(__dirname, "node_modules/tiddlywiki/tiddlywiki.js"),
        "+plugins/tiddlywiki/filesystem",
        "+plugins/tiddlywiki/tiddlyweb",
        wiki,
        "--listen",
        "host=127.0.0.1",
        "port=3001",
      ],
      { stdio: "inherit" },
    );
    const startedChild = child;
    // Keep an error listener after readiness cleanup, without starting a supervisor.
    child.on("error", (error) => {
      if (child === startedChild && ready && !stopping) {
        ready = false;
        console.error(error);
        process.exitCode = 1;
      }
    });
    console.log("TiddlyWiki PID", child.pid, "internal 127.0.0.1:3001");
    readiness = new AbortController();
    await waitReady(child, { signal: readiness.signal });
    if (stopping) return;
    ready = true;
    revision++;
    announce();
    console.log("Wiki ready; revision", revision);
  } catch (error) {
    if (!stopping) {
      console.error(error);
      process.exitCode = 1;
    }
  } finally {
    readiness = undefined;
    restarting = false;
    if (pending && !stopping) {
      pending = false;
      schedule();
    }
  }
}
function schedule() {
  if (stopping) return;
  clearTimeout(timer);
  timer = setTimeout(restart, 600);
}
let watcher, server, heartbeat;
function start() {
  watcher = fs.watch(wiki, { recursive: true }, (event, filename) => {
    if (!filename) return;
    const relative = String(filename);
    if (relative.split(path.sep).some((p) => p.startsWith(".") || p === "output"))
      return;
    const base = path.basename(relative).replace(/\.tid$/, "");
    if (uiState.test(base)) return;
    try {
      const fd = fs.openSync(path.join(wiki, relative), "r");
      const buffer = Buffer.alloc(2048);
      const size = fs.readSync(fd, buffer, 0, 2048, 0);
      fs.closeSync(fd);
      const title = buffer.toString("utf8", 0, size).match(/^title: (.+)$/m);
      if (title && uiState.test(title[1])) return;
    } catch (_) {}
    console.log("Wiki source changed:", relative);
    schedule();
  });
  server = http.createServer((req, res) => {
    if (req.url === "/__wiki_events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");
      clients.add(res);
      if (ready) res.write(`data: ${JSON.stringify(revision)}\n\n`);
      req.on("close", () => clients.delete(res));
      return;
    }
    if (!ready) {
      res.writeHead(503, { "Retry-After": "2" });
      res.end("Wiki is restarting; retry shortly.");
      return;
    }
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: 3001,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, "accept-encoding": "identity" },
      },
      (response) => {
        const html = /text\/html/.test(response.headers["content-type"] || "");
        const headers = { ...response.headers };
        if (html) {
          delete headers["content-length"];
          delete headers.etag;
          res.writeHead(response.statusCode, headers);
          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("end", () =>
            res.end(
              Buffer.concat(chunks)
                .toString()
                .replace("</body>", script + "</body>"),
            ),
          );
        } else {
          res.writeHead(response.statusCode, headers);
          response.pipe(res);
        }
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end("Wiki unavailable");
    });
    req.pipe(upstream);
  });
  heartbeat = setInterval(() => {
    for (const res of clients) res.write(": heartbeat\n\n");
  }, 15000);
  function stop() {
    stopping = true;
    ready = false;
    readiness?.abort();
    watcher.close();
    clearTimeout(timer);
    clearInterval(heartbeat);
    for (const res of clients) res.end();
    server.close();
    if (child) child.kill("SIGTERM");
  }
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  server.listen(3000, "0.0.0.0", () =>
    console.log("Wiki proxy listening on 0.0.0.0:3000"),
  );
  restart();
}
if (require.main === module) start();
module.exports = { waitReady, stopChild };
