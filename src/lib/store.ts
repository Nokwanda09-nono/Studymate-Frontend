// src/lib/store.ts

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  INITIAL_STUDY_POINTS,
  LOW_POINTS_THRESHOLD,
  MISSED_SESSION_DEDUCTION,
  clampStudyPoints,
  getStudyTier,
} from "../utils/studyPoints";

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
}

export interface UserProfile {
  studyHoursPerDay?: number | string;
  studyDaysPerWeek?: number | string;
  academicGoal?: string;
  studyStyle?: string;
  fieldOfStudy?: string;
  academicLevel?: string;
  preferredStudyTime?: string;
  learningStyle?: string;
  productiveTime?: string;
  qualification?: string;
  studyChallenges?: string[];
  studyPoints?: number;
  studyTier?: string;
  selectedAvatar?: string;
  lowPointsAlertSent?: boolean;
  accountDeletionWarning?: boolean;
  pointsInitialized?: boolean;
  lastPointsEvaluationDate?: string;
}

export interface Module {
  id: string;
  name: string;
  color: string;
  icon: string;
  fileCount: number;
}

export interface FileItem {
  id: string;
  moduleId: string;
  name: string;
  type: string;
  size: number;

  /**
   * Local URI of the uploaded document.
   * This will be needed later when we process documents
   * for the AI tutor / RAG system.
   */
  uri: string;

  /**
   * ISO string is used instead of Date because AsyncStorage
   * stores JSON and does not preserve JavaScript Date objects.
   */
  uploadedAt: string;
}

export interface Assessment {
  id: string;
  moduleId: string;
  type: "quiz" | "test" | "mock_exam";
  title: string;
  questionCount: number;
  completed: boolean;
  score?: number;
}

export interface ScheduleItem {
  id: string;
  title: string;
  moduleId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  color: string;
  is_recurring: boolean;
}

export interface AttendanceRecord {
  id: string;
  scheduleId: string;
  date: string;
  status: "present" | "absent";
}

class Store {
  private modules: Module[] = [];
  private files: FileItem[] = [];
  private assessments: Assessment[] = [];
  private schedule: ScheduleItem[] = [];
  private attendance: AttendanceRecord[] = [];
  private user: User | null = null;
  private profile: UserProfile | null = null;

  /**
   * Indicates whether AsyncStorage has finished loading.
   * This is useful for preventing the application from treating
   * the initial empty arrays as the real stored data.
   */
  private initialized = false;

  /**
   * Promise that resolves once all stored data has been loaded.
   */
  private initializationPromise: Promise<void>;

  constructor() {
    this.initializationPromise = this.loadFromStorage();
  }

  /**
   * Allows the React context to wait until AsyncStorage
   * has finished loading.
   */
  async waitForInitialization(): Promise<void> {
    await this.initializationPromise;
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const [
        modules,
        files,
        assessments,
        schedule,
        attendance,
        user,
        profile,
      ] = await Promise.all([
        AsyncStorage.getItem("modules"),
        AsyncStorage.getItem("files"),
        AsyncStorage.getItem("assessments"),
        AsyncStorage.getItem("schedule"),
        AsyncStorage.getItem("attendance"),
        AsyncStorage.getItem("user"),
        AsyncStorage.getItem("profile"),
      ]);

      if (modules) {
        this.modules = JSON.parse(modules);
      }

      if (files) {
        const parsedFiles = JSON.parse(files);

        /**
         * Older versions of the app may contain files where
         * uploadedAt was stored as a Date/string and may not
         * contain uri.
         *
         * We keep those files instead of crashing the store.
         */
        this.files = parsedFiles.map((file: any) => ({
          ...file,
          uri: typeof file.uri === "string" ? file.uri : "",
          uploadedAt:
            typeof file.uploadedAt === "string"
              ? file.uploadedAt
              : new Date(file.uploadedAt || Date.now()).toISOString(),
        }));
      }

      if (assessments) {
        this.assessments = JSON.parse(assessments);
      }

      if (schedule) {
        this.schedule = JSON.parse(schedule);
      }

      if (attendance) {
        this.attendance = JSON.parse(attendance);
      }

      if (user) {
        this.user = JSON.parse(user);
      }

      if (profile) {
        this.profile = JSON.parse(profile);
      }

      /**
       * Recalculate module file counts after loading.
       * This protects against old/stale fileCount values.
       */
      this.modules = this.modules.map((module) => ({
        ...module,
        fileCount: this.files.filter(
          (file) => file.moduleId === module.id,
        ).length,
      }));

      this.initialized = true;
    } catch (error) {
      console.error("Error loading data from AsyncStorage:", error);

      /**
       * Even if storage loading fails, allow the application
       * to continue instead of remaining stuck forever.
       */
      this.initialized = true;
    }
  }

  private async saveToStorage(
    key: string,
    data: unknown,
  ): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
    }
  }

  // ============================================================
  // MODULE METHODS
  // ============================================================

  getModules(): Module[] {
    return [...this.modules];
  }

  addModule(module: Module): void {
    this.modules = [...this.modules, module];

    void this.saveToStorage("modules", this.modules);
  }

  deleteModule(id: string): void {
    this.modules = this.modules.filter(
      (module) => module.id !== id,
    );

    this.files = this.files.filter(
      (file) => file.moduleId !== id,
    );

    this.assessments = this.assessments.filter(
      (assessment) => assessment.moduleId !== id,
    );

    void this.saveToStorage("modules", this.modules);
    void this.saveToStorage("files", this.files);
    void this.saveToStorage("assessments", this.assessments);
  }

  // ============================================================
  // FILE METHODS
  // ============================================================

  getFiles(): FileItem[] {
    return [...this.files];
  }

  addFile(file: FileItem): void {
    /**
     * Normalize the upload date before storing.
     */
    const normalizedFile: FileItem = {
      ...file,
      uri: file.uri || "",
      uploadedAt:
        typeof file.uploadedAt === "string"
          ? file.uploadedAt
          : new Date(file.uploadedAt).toISOString(),
    };

    this.files = [...this.files, normalizedFile];

    /**
     * Update the file count of the associated module.
     */
    const moduleIndex = this.modules.findIndex(
      (module) => module.id === normalizedFile.moduleId,
    );

    if (moduleIndex !== -1) {
      this.modules[moduleIndex] = {
        ...this.modules[moduleIndex],
        fileCount: this.files.filter(
          (storedFile) =>
            storedFile.moduleId === normalizedFile.moduleId,
        ).length,
      };
    }

    void this.saveToStorage("files", this.files);
    void this.saveToStorage("modules", this.modules);
  }

  deleteFile(id: string): void {
    const file = this.files.find(
      (storedFile) => storedFile.id === id,
    );

    this.files = this.files.filter(
      (storedFile) => storedFile.id !== id,
    );

    if (file) {
      const moduleIndex = this.modules.findIndex(
        (module) => module.id === file.moduleId,
      );

      if (moduleIndex !== -1) {
        this.modules[moduleIndex] = {
          ...this.modules[moduleIndex],
          fileCount: this.files.filter(
            (storedFile) =>
              storedFile.moduleId === file.moduleId,
          ).length,
        };
      }
    }

    void this.saveToStorage("files", this.files);
    void this.saveToStorage("modules", this.modules);
  }

  // ============================================================
  // ASSESSMENT METHODS
  // ============================================================

  getAssessments(): Assessment[] {
    return [...this.assessments];
  }

  addAssessment(assessment: Assessment): void {
    this.assessments = [
      ...this.assessments,
      assessment,
    ];

    void this.saveToStorage(
      "assessments",
      this.assessments,
    );
  }

  updateAssessment(
    id: string,
    updates: Partial<Assessment>,
  ): void {
    const index = this.assessments.findIndex(
      (assessment) => assessment.id === id,
    );

    if (index !== -1) {
      this.assessments[index] = {
        ...this.assessments[index],
        ...updates,
      };

      void this.saveToStorage(
        "assessments",
        this.assessments,
      );
    }
  }

  // ============================================================
  // SCHEDULE METHODS
  // ============================================================

  getSchedule(): ScheduleItem[] {
    return [...this.schedule];
  }

  addScheduleItem(item: ScheduleItem): void {
    this.schedule = [
      ...this.schedule,
      item,
    ];

    void this.saveToStorage(
      "schedule",
      this.schedule,
    );
  }

  deleteScheduleItem(id: string): void {
    this.schedule = this.schedule.filter(
      (scheduleItem) =>
        scheduleItem.id !== id,
    );

    void this.saveToStorage(
      "schedule",
      this.schedule,
    );
  }

  // ============================================================
  // ATTENDANCE METHODS
  // ============================================================

  getAttendance(): AttendanceRecord[] {
    return [...this.attendance];
  }

  addAttendance(record: AttendanceRecord): void {
    this.attendance = [
      ...this.attendance,
      record,
    ];

    void this.saveToStorage(
      "attendance",
      this.attendance,
    );
  }

  initializeStudyPoints(profile: UserProfile = {}): UserProfile {
    if (typeof profile.studyPoints === "number") {
      return {
        ...profile,
        studyTier: profile.studyTier || getStudyTier(profile.studyPoints).name,
        pointsInitialized: true,
      };
    }

    return {
      ...profile,
      studyPoints: INITIAL_STUDY_POINTS,
      studyTier: getStudyTier(INITIAL_STUDY_POINTS).name,
      pointsInitialized: true,
      lowPointsAlertSent: false,
      accountDeletionWarning: false,
    };
  }

  evaluateMissedSessions(now = new Date()): UserProfile | null {
    if (!this.profile || !this.schedule.length) {
      return this.profile;
    }

    const currentDate = new Date(now);
    const today = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate(),
    );
    const lastEvaluation = this.profile.lastPointsEvaluationDate
      ? new Date(this.profile.lastPointsEvaluationDate)
      : new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    let points = typeof this.profile.studyPoints === "number"
      ? this.profile.studyPoints
      : INITIAL_STUDY_POINTS;
    const attendance = [...this.attendance];

    for (
      const date = new Date(lastEvaluation.getTime());
      date < today;
      date.setDate(date.getDate() + 1)
    ) {
      const dateKey = date.toISOString().slice(0, 10);
      const dayOfWeek = (date.getDay() + 6) % 7;

      this.schedule
        .filter((item) => item.is_recurring && item.dayOfWeek === dayOfWeek)
        .forEach((item) => {
          const alreadyRecorded = attendance.some(
            (record) => record.scheduleId === item.id && record.date === dateKey,
          );

          if (!alreadyRecorded) {
            const absentRecord: AttendanceRecord = {
              id: `absence-${item.id}-${dateKey}`,
              scheduleId: item.id,
              date: dateKey,
              status: "absent",
            };
            attendance.push(absentRecord);
            points -= MISSED_SESSION_DEDUCTION;
          }
        });
    }

    const nextProfile = {
      ...this.profile,
      studyPoints: clampStudyPoints(points),
      studyTier: getStudyTier(points).name,
      lastPointsEvaluationDate: today.toISOString(),
      lowPointsAlertSent:
        this.profile.lowPointsAlertSent || points <= LOW_POINTS_THRESHOLD,
      accountDeletionWarning:
        this.profile.accountDeletionWarning || points <= 0,
    };

    this.attendance = attendance;
    this.profile = nextProfile;
    void this.saveToStorage("attendance", this.attendance);
    void this.saveToStorage("profile", this.profile);
    return nextProfile;
  }

  // ============================================================
  // USER METHODS
  // ============================================================

  getUser(): User | null {
    return this.user;
  }

  setUser(user: User): void {
    this.user = user;

    void this.saveToStorage(
      "user",
      user,
    );
  }

  // ============================================================
  // PROFILE METHODS
  // ============================================================

  getProfile(): UserProfile | null {
    return this.profile;
  }

  setProfile(profile: UserProfile): void {
    this.profile = profile;

    void this.saveToStorage(
      "profile",
      profile,
    );
  }

  // ============================================================
  // CLEAR ALL DATA
  // ============================================================

  async clearAllData(): Promise<void> {
    this.modules = [];
    this.files = [];
    this.assessments = [];
    this.schedule = [];
    this.attendance = [];
    this.user = null;
    this.profile = null;

    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error(
        "Error clearing AsyncStorage:",
        error,
      );
    }
  }
}

export const store = new Store();