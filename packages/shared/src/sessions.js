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

export function truncateChatSummary(text, maxLength = 72) {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export function formatSessionListLabel(session) {
  if (!session || typeof session !== "object") {
    return "";
  }
  const summary = truncateChatSummary(session.summary || session.title || "");
  let base = summary;
  if (!base) {
    if (session.created_at) {
      const date = new Date(session.created_at);
      if (!Number.isNaN(date.getTime())) {
        const when = date.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
        base = `New chat · ${when}`;
      }
    }
    if (!base) {
      base = "New chat";
    }
  }
  if (session.access_source !== "granted") {
    return base;
  }
  const level = session.access_level || "view";
  const owner = session.owner_user_id ? ` from ${session.owner_user_id}` : "";
  return `${base} (granted ${level}${owner})`;
}