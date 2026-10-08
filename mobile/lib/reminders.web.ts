import type { FollowUp } from "./api";

export async function ensureReminderPermission() {
  return false;
}

export async function syncReminders(_items: FollowUp[]) {
  return 0;
}

export async function cancelAllReminders() {
  return;
}

export function listenReminderTaps(_onOpen: (leadId: number | null) => void) {
  return () => undefined;
}
