export function sentBody(init: RequestInit | undefined): unknown {
  const body = init?.body;
  if (typeof body !== "string") throw new Error("Corps de requête absent ou non textuel.");
  return JSON.parse(body);
}
