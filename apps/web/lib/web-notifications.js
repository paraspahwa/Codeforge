/** Browser notifications for cowork job completion */

const PERMISSION_KEY = "codeforge_notifications_asked";

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function ensureNotificationPermission() {
  if (!notificationsSupported()) {
    return false;
  }
  if (Notification.permission === "granted") {
    return true;
  }
  if (Notification.permission === "denied") {
    return false;
  }
  const asked = localStorage.getItem(PERMISSION_KEY);
  if (!asked) {
    localStorage.setItem(PERMISSION_KEY, "1");
  }
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function notifyCoworkJobComplete({ title, body, tag }) {
  if (!notificationsSupported() || Notification.permission !== "granted") {
    return;
  }
  try {
    new Notification(title || "Cowork job finished", {
      body: body || "Your scheduled job completed.",
      tag: tag || "cowork-job",
      icon: "/icon.svg",
    });
  } catch {
    // ignore — some browsers block without user gesture
  }
}
