/** Shared session id in URL query (?s=) across /app and /code */

export const SESSION_QUERY_KEY = "s";

export function readSessionIdFromSearch(search) {
  if (!search) {
    return null;
  }
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get(SESSION_QUERY_KEY);
}

export function readSessionIdFromUrl() {
  if (typeof window === "undefined") {
    return null;
  }
  return readSessionIdFromSearch(window.location.search);
}

export function buildSessionPath(pathname, sessionId) {
  const params = new URLSearchParams();
  if (sessionId) {
    params.set(SESSION_QUERY_KEY, sessionId);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function syncSessionIdInUrl(router, pathname, sessionId) {
  if (!router || !pathname) {
    return;
  }
  router.replace(buildSessionPath(pathname, sessionId), { scroll: false });
}
