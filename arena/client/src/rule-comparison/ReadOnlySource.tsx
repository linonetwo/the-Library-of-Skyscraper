import { useLayoutEffect, useRef } from 'react';

/** Scroll only this source pane; keep the surrounding dialog at its current place. */
export function ReadOnlySource({text, line}: {text: string; line: number}) {
  const pane = useRef<HTMLPreElement>(null);
  useLayoutEffect(() => {
    const container = pane.current;
    const selected = container?.querySelector<HTMLElement>('[data-selected-source-line]');
    if (!container || !selected) return;
    container.scrollTop += selected.getBoundingClientRect().top
      - container.getBoundingClientRect().top - container.clientHeight / 3;
  }, [text, line]);
  return <pre ref={pane} className="readonly-rule-source" aria-label={`只读源码，第${line}行`}>
    {text.split('\n').map((value, index) => <span key={index}
      className={index + 1 === line ? 'source-selected' : ''}
      data-selected-source-line={index + 1 === line ? '' : undefined}
    >{String(index + 1).padStart(3)} {value}{'\n'}</span>)}
  </pre>;
}
