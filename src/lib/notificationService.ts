import { Platform } from "react-native";
import { ScheduleItem } from "./store";

export type NotificationPermissionState =
  | "granted"
  | "denied"
  | "undetermined"
  | "unsupported";

interface NotificationService {
  getNotificationPermissionStatus: () => Promise<NotificationPermissionState>;
  requestNotificationPermission: () => Promise<boolean>;
  sendUserNotification: (title: string, body: string) => Promise<boolean>;
  cancelStudyReminders: () => Promise<void>;
  syncStudyReminders: (
    schedule: ScheduleItem[],
  ) => Promise<() => Promise<void>>;
}

declare const require: (path: string) => NotificationService;

const service =
  Platform.OS === "web"
    ? require("./notificationService.web")
    : require("./notificationService.native");

export const getNotificationPermissionStatus =
  service.getNotificationPermissionStatus;
export const requestNotificationPermission = service.requestNotificationPermission;
export const sendUserNotification = service.sendUserNotification;
export const cancelStudyReminders = service.cancelStudyReminders;
export const syncStudyReminders = service.syncStudyReminders;
