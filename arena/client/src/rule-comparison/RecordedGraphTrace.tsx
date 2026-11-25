import { useEffect, useRef, useState } from 'react';
import { arenaApi } from '../arenaApi';
import type { Session } from '../types';
import { getGraphSourceRef } from '../../../behavior-modules/graph';
import { graphTrace, TraceView } from './TraceView';
import './comparison.css';

/** Every node link resolves against the authenticated archive for this hash. */
export function RecordedGraphTrace({session, sourceHash, value, operationIndex, label}: {
  session: Session | null; sourceHash: string; value: unknown;
  operationIndex?: number | null; label: string;
}) {
  const [source, setSource] = useState<{file: string; line: number; text: string} | null>(null);
  const [error, setError] = useState('');
  const request = useRef(0);
  useEffect(() => {request.current++; setSource(null); setError(''); return () => {request.current++;};},
    [session?.sessionId, session?.token, sourceHash, operationIndex]);
  const trace = graphTrace(value);
  if (!trace) return null;
  const locate = async (id: string) => {
    if (!session) {setError('没有该录制所属的登录凭据，无法读取私有源码。'); return;}
    const revision = ++request.current; setError('');
    try {
      const archived = await arenaApi.scriptVersion(session, sourceHash);
      if(revision !== request.current) return;
      const ref = getGraphSourceRef(archived.project, id);
      if (!ref) {setError(`该版源码没有对象 ${id} 的位置。`); return;}
      setSource({...ref, text:archived.project.files[ref.file] ?? ''});
    } catch(cause) {if(revision === request.current) setError((cause as Error).message);}
  };
  return <section className="recorded-graph-trace" aria-label={`${label}图路径`}>
    <h4>{label} · 真实规则图选择</h4>
    <p>版本 <code>{sourceHash}</code> · 路径tick {trace.tick} · {operationIndex == null ? '操作序号不可用' : `状态截至操作 ${operationIndex}`}</p>
    <p>路径表示规则选择；是否命中或入库请看该局事件。</p>
    <TraceView value={trace} locate={id => void locate(id)} />
    {error && <p role="alert">{error}</p>}
    {source && <details open><summary>该版只读源码 · {source.file}:{source.line}</summary><pre>{source.text.split('\n').map((line,i) => <span key={i} className={i+1 === source.line ? 'source-selected' : ''}>{i+1} {line}{'\n'}</span>)}</pre></details>}
  </section>;
}
