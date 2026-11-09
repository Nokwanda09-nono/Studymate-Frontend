import { ScheduleItem } from "./store";

export type NotificationPermissionState =
  | "granted"
  | "denied"
  | "undetermined"
  | "unsupported";

const getBrowserNotification = () =>
  typeof window !== "undefined" && "Notification" in window
    ? window.Notification
    : undefined;

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionState> {
  const BrowserNotification = getBrowserNotification();
  if (!BrowserNotification) {
    return "unsupported";
  }
  return BrowserNotification.permission === "default"
    ? "undetermined"
    : BrowserNotification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const BrowserNotification = getBrowserNotification();
  if (!BrowserNotification) {
    return false;
  }

  return (await BrowserNotification.requestPermission()) === "granted";
}

export async function sendUserNotification(
  title: string,
  body: string,
): Promise<boolean> {
  const BrowserNotification = getBrowserNotification();
  if (!BrowserNotification || BrowserNotification.permission !== "granted") {
    return false;
  }

  new BrowserNotification(title, { body, icon: "/Logo.png" });
  return true;
}

const nextReminderDate = (session: ScheduleItem, now: Date) => {
  const jsDayOfWeek = (session.dayOfWeek + 1) % 7;
  const [hours, minutes] = session.startTime.split(":").map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    !Number.isInteger(session.dayOfWeek) ||
    session.dayOfWeek < 0 ||
    session.dayOfWeek > 6
  ) {
    console.warn(`Skipping reminder for invalid study session "${session.title}".`);
    return null;
  }

  const dayOffset = (jsDayOfWeek - now.getDay() + 7) % 7;
  const reminder = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    hours,
    minutes - 60,
    0,
    0,
  );
  if (reminder <= now) {
    reminder.setDate(reminder.getDate() + 7);
  }
  return reminder;
};

export async function cancelStudyReminders(): Promise<void> {}

export async function syncStudyReminders(
  schedule: ScheduleItem[],
): Promise<() => Promise<void>> {
  if ((await getNotificationPermissionStatus()) !== "granted") {
    return async () => {};
  }

  let active = true;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const scheduleNext = (session: ScheduleItem) => {
    const reminder = nextReminderDate(session, new Date());
    if (!reminder) {
      return;
    }

    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!active) {
        return;
      }

      void sendUserNotification(
        "Study session coming up",
        `${session.title} starts in one hour.`,
      ).catch((error) => {
        console.error("Could not show a study session reminder:", error);
      });
      scheduleNext(session);
    }, reminder.getTime() - Date.now());
    timers.add(timer);
  };

  schedule.forEach(scheduleNext);

  return async () => {
    active = false;
    timers.forEach(clearTimeout);
    timers.clear();
  };
}
