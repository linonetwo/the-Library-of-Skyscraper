import type { Command, Session, Snapshot } from "./types";

async function request<T>(
  path: string,
  session?: Session,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/sessions${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session && { Authorization: `Bearer ${session.token}` }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}

export const arenaApi = {
  create: (mode: "training" | "online") =>
    request<Session>("", undefined, { mode, seed: 42 }),
  join: (id: string) =>
    request<Session>(`/${encodeURIComponent(id.trim())}/join`, undefined, {}),
  state: (session: Session) =>
    request<Snapshot>(`/${session.sessionId}/state`, session),
  command: (session: Session, command: Command) =>
    request<Snapshot>(`/${session.sessionId}/commands`, session, command),
  replay: (session: Session) =>
    request<{ finalSnapshot: Snapshot }>(
      `/${session.sessionId}/replay`,
      session,
    ),
  subscribe: (session: Session) =>
    new WebSocket(
      `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/${session.sessionId}?token=${encodeURIComponent(session.token)}`,
    ),
};
