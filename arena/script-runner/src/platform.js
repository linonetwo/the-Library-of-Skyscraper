(() => {
  const NativeDate = Date;
  const tickTime = __arenaContext.tick * 500;
  class TickDate extends NativeDate {
    constructor(...args) {
      super(...(args.length ? args : [tickTime]));
    }
    static now() { return tickTime; }
  }
  globalThis.Date = TickDate;
  Math.random = () => { throw new Error("Use the rule context for deterministic choices"); };
  globalThis.__arenaSerialize = JSON.stringify;
  delete globalThis.Deno;
  delete globalThis.__bootstrap;
  delete globalThis.__infra;
  delete globalThis.console;
})();
