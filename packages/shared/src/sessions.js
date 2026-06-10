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
