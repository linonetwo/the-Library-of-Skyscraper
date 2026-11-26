import { TraceView } from "./rule-comparison/TraceView";
import { BehaviorTraceView, readBehaviorTrace } from "./BehaviorFlow";
import { PreviewStatePatch } from "./ScriptRuntime";
import type {
  CompileResult,
  ScriptPreview,
  RuleDiagnostic,
} from "./scriptTypes";
import type { GraphTrace } from "../../behavior-modules/graph";
export function WorkbenchRunPanel({
  hasSession,
  ready,
  busy,
  blocked,
  error,
  compilation,
  preview,
  currentGraphTrace,
  onRun,
  onDiagnostic,
  onLocateModule,
  onLocateGraph,
}: {
  hasSession: boolean;
  ready: boolean;
  busy: boolean;
  blocked: boolean;
  error: string;
  compilation: CompileResult | null;
  preview: ScriptPreview | null;
  currentGraphTrace: GraphTrace | null;
  onRun: (mode: "compile" | "preview" | "publish") => void;
  onDiagnostic: (diagnostic: RuleDiagnostic) => void;
  onLocateModule: (id: string) => void;
  onLocateGraph: (id: string) => void;
}) {
  const trace = readBehaviorTrace(
    preview?.execution?.decision?.memoryPatch?.set?.aiTrace,
  );
  return (
    <>
      <div className="script-toolbar">
        <button
          disabled={!hasSession || busy || blocked}
          onClick={() => onRun("compile")}
        >
          编译 TypeScript
        </button>
        <button
          disabled={!hasSession || busy || blocked}
          onClick={() => onRun("preview")}
        >
          试跑当前快照
        </button>
        <button
          className="primary"
          disabled={!ready || busy || blocked}
          onClick={() => onRun("publish")}
        >
          发布到战场
        </button>
      </div>
      <section className="script-results" aria-label="脚本运行结果">
        {busy && <p>处理中…</p>}
        {error && <p role="alert">{error}</p>}
        {compilation?.diagnostics.map((d, i) => (
          <button
            className="script-diagnostic"
            key={i}
            onClick={() => onDiagnostic(d)}
          >
            {d.file}:{d.line}:{d.column} · {d.message}
          </button>
        ))}
        {compilation?.bundle && (
          <p>编译通过 · {compilation.bundle.sourceHash.slice(0, 12)}</p>
        )}
        {preview?.execution && (
          <p>
            T{preview.tick} · V8 {preview.execution.durationMs.toFixed(2)} ms
          </p>
        )}
        {preview?.execution?.failure && (
          <p role="alert">{preview.execution.failure.message}</p>
        )}
        {preview?.execution?.decision && (
          <div aria-label="试跑动作意图">
            <strong>
              动作意图 {preview.execution.decision.intents.length} 条
            </strong>
            {preview.execution.decision.intents.map((intent, i) => (
              <div className="intent-row" key={i}>
                <code>{intent.actorId}</code>
                <b>{intent.type}</b>
                <span>
                  {intent.type === "run" ? `${intent.viaRoomId} → ${intent.roomId}`
                    : "edgeId" in intent ? intent.edgeId
                    : "roomId" in intent ? intent.roomId : intent.reason}
                </span>
              </div>
            ))}
          </div>
        )}
        {trace && preview?.sourceHash && (
          <BehaviorTraceView
            trace={trace}
            sourceHash={preview.sourceHash}
            source="试跑当前草稿"
            onLocate={onLocateModule}
          />
        )}
        {currentGraphTrace && (
          <section
            aria-label="当前草稿规则图试跑路径"
            data-source-hash={preview?.sourceHash}
          >
            <h4>当前草稿试跑 · {preview?.sourceHash}</h4>
            <TraceView value={currentGraphTrace} locate={onLocateGraph} />
          </section>
        )}
        {preview && <PreviewStatePatch preview={preview} />}
      </section>
    </>
  );
}
