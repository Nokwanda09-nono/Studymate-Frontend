import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../config/api";
import type {
  AppState,
  Assessment,
  AttendanceRecord,
  Module,
  ScheduleItem,
} from "./store";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isModule = (value: unknown): value is Module =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.color === "string" &&
  typeof value.icon === "string" &&
  typeof value.fileCount === "number";

const isAssessment = (value: unknown): value is Assessment =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.moduleId === "string" &&
  ["quiz", "test", "mock_exam"].includes(String(value.type)) &&
  typeof value.title === "string" &&
  typeof value.questionCount === "number" &&
  typeof value.completed === "boolean";

const isScheduleItem = (value: unknown): value is ScheduleItem =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.title === "string" &&
  typeof value.moduleId === "string" &&
  typeof value.dayOfWeek === "number" &&
  typeof value.startTime === "string" &&
  typeof value.endTime === "string" &&
  typeof value.color === "string" &&
  typeof value.is_recurring === "boolean";

const isAttendanceRecord = (value: unknown): value is AttendanceRecord =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.scheduleId === "string" &&
  typeof value.date === "string" &&
  (value.status === "present" || value.status === "absent");

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isAppState = (value: unknown): value is AppState => {
  if (!isRecord(value)) {
    return false;
  }

  const deleted = value.deleted;
  return (
    Array.isArray(value.modules) &&
    value.modules.every(isModule) &&
    Array.isArray(value.assessments) &&
    value.assessments.every(isAssessment) &&
    Array.isArray(value.schedule) &&
    value.schedule.every(isScheduleItem) &&
    Array.isArray(value.attendance) &&
    value.attendance.every(isAttendanceRecord) &&
    isRecord(deleted) &&
    ["modules", "assessments", "schedule", "attendance"].every(
      (collection) => isStringArray(deleted[collection]),
    ) &&
    (value.profile === null || isRecord(value.profile)) &&
    isRecord(value.settings)
  );
};

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const storedToken = await AsyncStorage.getItem("authToken");
  const token = storedToken?.trim().replace(/^(?:Bearer\s+)+/i, "");

  if (!token) {
    throw new Error("Sign in to sync your StudyMate data.");
  }

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

const parseResponse = async (
  response: Response,
): Promise<Record<string, unknown>> => {
  const text = await response.text();
  let payload: unknown = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(
        `The sync server returned an invalid response (HTTP ${response.status}).`,
      );
    }
  }

  const data = isRecord(payload) ? payload : {};
  if (!response.ok) {
    throw new Error(
      (typeof data.error === "string" && data.error) ||
        (typeof data.message === "string" && data.message) ||
        `Data sync failed (HTTP ${response.status}).`,
    );
  }

  if (!isRecord(payload)) {
    throw new Error("The sync server returned an invalid response.");
  }
  return payload;
};

export async function fetchAppState(): Promise<AppState | null> {
  const response = await fetch(`${API_URL}/app-state`, {
    headers: await getAuthHeaders(),
  });
  const payload = await parseResponse(response);

  if (payload.state === null || payload.state === undefined) {
    return null;
  }
  if (!isAppState(payload.state)) {
    throw new Error("The sync server returned an incomplete StudyMate data set.");
  }

  return payload.state;
}

export async function saveAppState(state: AppState): Promise<void> {
  const response = await fetch(`${API_URL}/app-state`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ state }),
  });
  await parseResponse(response);
}
