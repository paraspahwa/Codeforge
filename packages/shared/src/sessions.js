export function canWriteSession(session) {
  if (!session || typeof session !== "object") {
    return true;
  }
  if (session.access_source !== "granted") {
    return true;
  }
  return session.access_level === "delegate";
}

export function isViewOnlySession(session) {
  return !canWriteSession(session);
}

export function viewOnlySessionMessage(session) {
  if (!isViewOnlySession(session)) {
    return "";
  }
  const owner = session?.owner_user_id ? ` from ${session.owner_user_id}` : "";
  return `View-only access${owner}. Write actions are disabled.`;
}

export function formatSessionListLabel(session) {
  if (!session || typeof session !== "object") {
    return "";
  }
  const base = session.session_id || "";
  if (session.access_source !== "granted") {
    return base;
  }
  const level = session.access_level || "view";
  const owner = session.owner_user_id ? ` from ${session.owner_user_id}` : "";
  return `${base} (granted ${level}${owner})`;
}