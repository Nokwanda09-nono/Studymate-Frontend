import * as Notifications from "expo-notifications";
import { ScheduleItem } from "./store";

const REMINDER_FLAG = "studyMateSessionReminder";
const CHANNEL_ID = "study-reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationPermissionState =
  | "granted"
  | "denied"
  | "undetermined"
  | "unsupported";

const ensureChannel = async () => {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Study reminders",
    importance: Notifications.AndroidImportance.HIGH,
  });
};

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionState> {
  const permissions = await Notifications.getPermissionsAsync();
  return permissions.granted
    ? "granted"
    : permissions.canAskAgain
      ? "undetermined"
      : "denied";
}

export async function requestNotificationPermission(): Promise<boolean> {
  await ensureChannel();
  const permissionStatus = await getNotificationPermissionStatus();
  if (permissionStatus === "granted") {
    return true;
  }
  if (permissionStatus === "denied") {
    return false;
  }

  const permissions = await Notifications.requestPermissionsAsync();
  return permissions.granted;
}

export async function sendUserNotification(
  title: string,
  body: string,
): Promise<boolean> {
  if ((await getNotificationPermissionStatus()) !== "granted") {
    return false;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { studyMateEvent: true },
    },
    trigger: null,
  });
  return true;
}

export async function cancelStudyReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const reminders = scheduled.filter(
    (notification) => notification.content.data?.[REMINDER_FLAG] === true,
  );
  await Promise.all(
    reminders.map((notification) =>
      Notifications.cancelScheduledNotificationAsync(notification.identifier),
    ),
  );
}

export async function syncStudyReminders(
  schedule: ScheduleItem[],
): Promise<() => Promise<void>> {
  await cancelStudyReminders();

  if ((await getNotificationPermissionStatus()) !== "granted") {
    return async () => {};
  }

  await ensureChannel();
  const identifiers: string[] = [];

  for (const session of schedule) {
    const timeParts = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(session.startTime);
    if (!timeParts || !Number.isInteger(session.dayOfWeek) || session.dayOfWeek < 0 || session.dayOfWeek > 6) {
      console.warn(`Skipping reminder for invalid study session "${session.title}".`);
      continue;
    }
    const startMinutes = Number(timeParts[1]) * 60 + Number(timeParts[2]);

    let reminderMinutes = startMinutes - 60;
    let reminderDay = session.dayOfWeek;
    if (reminderMinutes < 0) {
      reminderMinutes += 24 * 60;
      reminderDay = (reminderDay + 6) % 7;
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Study session coming up",
        body: `${session.title} starts in one hour.`,
        data: { [REMINDER_FLAG]: true, scheduleId: session.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: reminderDay === 6 ? 1 : reminderDay + 2,
        hour: Math.floor(reminderMinutes / 60),
        minute: reminderMinutes % 60,
        channelId: CHANNEL_ID,
      },
    });
    identifiers.push(identifier);
  }

  return async () => {
    await Promise.all(
      identifiers.map((identifier) =>
        Notifications.cancelScheduledNotificationAsync(identifier),
      ),
    );
  };
}
