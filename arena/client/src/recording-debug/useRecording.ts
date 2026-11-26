import { useEffect, useState } from 'react';
import { arenaApi } from '../arenaApi';
import type { Session } from '../types';
import type { ReplayTimeline } from '../useReplay';
import type { RuleVersionList, RuleVersionSource } from '../scriptTypes';

/** Timeline refresh and archived-source selection have separate request lifetimes. */
export function useRecording(session: Session | null, sourceHash: string) {
  const [recording, setRecording] = useState<{timeline: ReplayTimeline; versions: RuleVersionList} | null>(null);
  const [archive, setArchive] = useState<RuleVersionSource | null>(null);
  const [error, setError] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true;
    setRecording(null); setError(''); setLoading(!!session);
    if (session) void Promise.all([arenaApi.timeline(session), arenaApi.scriptVersions(session)]).then(
      ([timeline, versions]) => {if (current) setRecording({timeline, versions});},
      (cause: Error) => {if (current) setError(cause.message);},
    ).finally(() => {if (current) setLoading(false);});
    return () => {current = false;};
  }, [session?.sessionId, session?.playerId, session?.token, refresh]);
  const selectedHash = sourceHash || recording?.versions.versions[0]?.sourceHash || '';
  useEffect(() => {
    let current = true;
    setArchive(null); setSourceError('');
    if (session && selectedHash) void arenaApi.scriptVersion(session, selectedHash).then(
      value => {if (current) setArchive(value);},
      (cause: Error) => {if (current) setSourceError(cause.message);},
    );
    return () => {current = false;};
  }, [session?.sessionId, session?.playerId, session?.token, selectedHash]);
  return {recording, archive, loading, sourceHash: selectedHash, error: error || sourceError, refresh: () => setRefresh(value => value + 1)};
}
