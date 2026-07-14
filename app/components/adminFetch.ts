export const ADMIN_SESSION_EXPIRED_EVENT = "admin-session-expired";

export function notifyIfSessionExpired(status: number): void {
  if (status === 401) window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT));
}

export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  notifyIfSessionExpired(response.status);
  return response;
}
