// src/lib/store.ts

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    ATTENDED_SESSION_RECOVERY,
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
  studyHours?: number | string;
  year?: string;
  academicGoal?: string;
  studyStyle?: string;
  fieldOfStudy?: string;
  academicLevel?: string;
  preferredStudyTime?: string;
  learningStyle?: string;
  reminderFrequency?: string;
  aiSupport?: string;
  resourceRecommendations?: string;
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
  remoteId?: string;
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
  questions?: QuizQuestion[];
  remoteOnly?: boolean;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options?: string[];
  correctAnswer?: number;
  type?: "mcq" | "open_ended";
  sampleAnswer?: string;
  explanation?: string;
  userAnswer?: string;
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
  pointsProcessed?: boolean;
}

export interface AppState {
  modules: Module[];
  assessments: Assessment[];
  schedule: ScheduleItem[];
  attendance: AttendanceRecord[];
  deleted: {
    modules: string[];
    assessments: string[];
    schedule: string[];
    attendance: string[];
  };
  profile: UserProfile | null;
  settings: Record<string, unknown>;
}

class Store {
  private modules: Module[] = [];
  private files: FileItem[] = [];
  private assessments: Assessment[] = [];
  private schedule: ScheduleItem[] = [];
  private attendance: AttendanceRecord[] = [];
  private deleted: AppState["deleted"] = {
    modules: [],
    assessments: [],
    schedule: [],
    attendance: [],
  };
  private settings: Record<string, unknown> = {};
  private user: User | null = null;
  private profile: UserProfile | null = null;
  private activeUserId: string | null = null;
  private pendingRemoteFileDeletions: string[] = [];

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
    this.initializationPromise = Promise.resolve();
  }

  private storageKey(key: string): string {
    return this.activeUserId ? `user:${this.activeUserId}:${key}` : key;
  }

  async loadForUser(userId: string): Promise<void> {
    this.activeUserId = userId;
    this.modules = [];
    this.files = [];
    this.assessments = [];
    this.schedule = [];
    this.attendance = [];
    this.deleted = {
      modules: [],
      assessments: [],
      schedule: [],
      attendance: [],
    };
    this.settings = {};
    this.user = null;
    this.profile = null;
    this.pendingRemoteFileDeletions = [];
    await this.loadFromStorage(userId);
  }

  /**
   * Allows the React context to wait until AsyncStorage
   * has finished loading.
   */
  async waitForInitialization(): Promise<void> {
    await this.initializationPromise;
  }

  private async loadFromStorage(userId?: string): Promise<void> {
    try {
      const [
        modules,
        files,
        assessments,
        schedule,
        attendance,
        deleted,
        settings,
        user,
        profile,
        pendingRemoteFileDeletions,
      ] = await Promise.all([
        AsyncStorage.getItem(this.storageKey("modules")),
        AsyncStorage.getItem(this.storageKey("files")),
        AsyncStorage.getItem(this.storageKey("assessments")),
        AsyncStorage.getItem(this.storageKey("schedule")),
        AsyncStorage.getItem(this.storageKey("attendance")),
        AsyncStorage.getItem(this.storageKey("deleted")),
        AsyncStorage.getItem(this.storageKey("settings")),
        AsyncStorage.getItem(this.storageKey("user")),
        AsyncStorage.getItem(this.storageKey("profile")),
        AsyncStorage.getItem(this.storageKey("pendingRemoteFileDeletions")),
      ]);

      if (modules) {
        const loadedModules: Module[] = JSON.parse(modules);
        const moduleIds = new Set<string>();
        this.modules = loadedModules.filter((module) => {
          if (moduleIds.has(module.id)) {
            return false;
          }
          moduleIds.add(module.id);
          return true;
        });
        if (this.modules.length !== loadedModules.length) {
          void this.saveToStorage("modules", this.modules);
        }
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
        this.attendance = JSON.parse(attendance).map((record: AttendanceRecord) => ({
          ...record,
          // Older absence records already had the previous deduction applied.
          pointsProcessed:
            record.pointsProcessed ?? record.status === "absent",
        }));
      }

      if (deleted) {
        this.deleted = JSON.parse(deleted);
      }

      if (settings) {
        this.settings = JSON.parse(settings);
      }

      if (user) {
        this.user = JSON.parse(user);
      }

      if (profile) {
        this.profile = JSON.parse(profile);
      }

      if (pendingRemoteFileDeletions) {
        this.pendingRemoteFileDeletions = JSON.parse(pendingRemoteFileDeletions);
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
      await AsyncStorage.setItem(this.storageKey(key), JSON.stringify(data));
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
    this.deleted.modules = this.deleted.modules.filter((id) => id !== module.id);
    this.modules = [...this.modules, module];

    void this.saveToStorage("modules", this.modules);
    void this.saveToStorage("deleted", this.deleted);
  }

  deleteModule(id: string): void {
    const removedAssessments = this.assessments.filter(
      (assessment) => assessment.moduleId === id,
    );
    this.deleted.modules = [...new Set([...this.deleted.modules, id])];
    this.deleted.assessments = [
      ...new Set([
        ...this.deleted.assessments,
        ...removedAssessments.map((assessment) => assessment.id),
      ]),
    ];
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
    void this.saveToStorage("deleted", this.deleted);
  }

  // ============================================================
  // FILE METHODS
  // ============================================================

  getFiles(): FileItem[] {
    return [...this.files];
  }

  getPendingRemoteFileDeletions(): string[] {
    return [...this.pendingRemoteFileDeletions];
  }

  async addPendingRemoteFileDeletion(remoteId: string): Promise<void> {
    if (this.pendingRemoteFileDeletions.includes(remoteId)) {
      return;
    }
    this.pendingRemoteFileDeletions = [
      ...this.pendingRemoteFileDeletions,
      remoteId,
    ];
    await this.saveToStorage(
      "pendingRemoteFileDeletions",
      this.pendingRemoteFileDeletions,
    );
  }

  async removePendingRemoteFileDeletion(remoteId: string): Promise<void> {
    this.pendingRemoteFileDeletions =
      this.pendingRemoteFileDeletions.filter((id) => id !== remoteId);
    await this.saveToStorage(
      "pendingRemoteFileDeletions",
      this.pendingRemoteFileDeletions,
    );
  }

  async setFileRemoteId(fileId: string, remoteId: string): Promise<void> {
    const file = this.files.find((storedFile) => storedFile.id === fileId);
    if (!file) {
      return;
    }
    file.remoteId = remoteId;
    await this.saveToStorage("files", this.files);
  }

  mergeRemoteFiles(remoteFiles: FileItem[]): void {
    const filesByRemoteId = new Map(
      this.files
        .filter((file) => file.remoteId)
        .map((file) => [file.remoteId as string, file]),
    );
    const filesById = new Map(
      this.files.map((file) => [file.id, file]),
    );

    remoteFiles.forEach((remoteFile) => {
      const existing = remoteFile.remoteId
        ? filesByRemoteId.get(remoteFile.remoteId) ?? filesById.get(remoteFile.id)
        : filesById.get(remoteFile.id);

      if (existing) {
        Object.assign(existing, remoteFile, { id: existing.id });
        if (remoteFile.remoteId) {
          filesByRemoteId.set(remoteFile.remoteId, existing);
        }
        return;
      }

      this.files.push(remoteFile);
      filesById.set(remoteFile.id, remoteFile);
      if (remoteFile.remoteId) {
        filesByRemoteId.set(remoteFile.remoteId, remoteFile);
      }
    });

    void this.saveToStorage("files", this.files);
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
    this.deleted.assessments = this.deleted.assessments.filter(
      (id) => id !== assessment.id,
    );
    this.assessments = [
      ...this.assessments,
      assessment,
    ];

    void this.saveToStorage(
      "assessments",
      this.assessments,
    );
    void this.saveToStorage("deleted", this.deleted);
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
    this.deleted.schedule = this.deleted.schedule.filter((id) => id !== item.id);
    this.schedule = [
      ...this.schedule,
      item,
    ];

    void this.saveToStorage(
      "schedule",
      this.schedule,
    );
    void this.saveToStorage("deleted", this.deleted);
  }

  deleteScheduleItem(id: string): void {
    this.deleted.schedule = [...new Set([...this.deleted.schedule, id])];
    this.schedule = this.schedule.filter(
      (scheduleItem) =>
        scheduleItem.id !== id,
    );

    void this.saveToStorage(
      "schedule",
      this.schedule,
    );
    void this.saveToStorage("deleted", this.deleted);
  }

  // ============================================================
  // ATTENDANCE METHODS
  // ============================================================

  getAttendance(): AttendanceRecord[] {
    return [...this.attendance];
  }

  getSettings(): Record<string, unknown> {
    return { ...this.settings };
  }

  setSettings(settings: Record<string, unknown>): void {
    this.settings = { ...settings };
    void this.saveToStorage("settings", this.settings);
  }

  getAppState(): AppState {
    return {
      modules: this.getModules(),
      assessments: this.getAssessments(),
      schedule: this.getSchedule(),
      attendance: this.getAttendance(),
      deleted: {
        modules: [...this.deleted.modules],
        assessments: [...this.deleted.assessments],
        schedule: [...this.deleted.schedule],
        attendance: [...this.deleted.attendance],
      },
      profile: this.getProfile(),
      settings: this.getSettings(),
    };
  }

  replaceAppState(state: AppState): void {
    this.modules = state.modules.map((module) => ({
      ...module,
      fileCount: this.files.filter((file) => file.moduleId === module.id).length,
    }));
    this.assessments = [...state.assessments];
    this.schedule = [...state.schedule];
    this.attendance = state.attendance.map((record) => ({
      ...record,
      pointsProcessed:
        record.pointsProcessed ?? record.status === "absent",
    }));
    this.profile = state.profile;
    this.deleted = {
      modules: [...state.deleted.modules],
      assessments: [...state.deleted.assessments],
      schedule: [...state.deleted.schedule],
      attendance: [...state.deleted.attendance],
    };
    this.settings = { ...state.settings };

    void this.saveToStorage("modules", this.modules);
    void this.saveToStorage("assessments", this.assessments);
    void this.saveToStorage("schedule", this.schedule);
    void this.saveToStorage("attendance", this.attendance);
    void this.saveToStorage("deleted", this.deleted);
    void this.saveToStorage("profile", this.profile);
    void this.saveToStorage("settings", this.settings);
  }

  addAttendance(record: AttendanceRecord): void {
    const existingIndex = this.attendance.findIndex(
      (storedRecord) =>
        storedRecord.scheduleId === record.scheduleId &&
        storedRecord.date === record.date,
    );

    if (existingIndex >= 0) {
      const existingRecord = this.attendance[existingIndex];

      if (existingRecord.status === "absent" && record.status === "present") {
        this.attendance[existingIndex] = {
          ...existingRecord,
          ...record,
          pointsProcessed: true,
        };

        if (this.profile) {
          const points = clampStudyPoints(
            (this.profile.studyPoints ?? INITIAL_STUDY_POINTS) +
              ATTENDED_SESSION_RECOVERY,
          );
          this.profile = {
            ...this.profile,
            studyPoints: points,
            studyTier: getStudyTier(points).name,
          };
          void this.saveToStorage("profile", this.profile);
        }
      }
    } else {
      this.attendance = [...this.attendance, record];
    }

    void this.saveToStorage(
      "attendance",
      this.attendance,
    );
  }

  initializeStudyPoints(profile: UserProfile = {}): UserProfile {
    if (typeof profile.studyPoints === "number") {
      return {
        ...profile,
        studyPoints: clampStudyPoints(profile.studyPoints),
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
          const existingRecord = attendance.find(
            (record) => record.scheduleId === item.id && record.date === dateKey,
          );

          if (!existingRecord) {
            const absentRecord: AttendanceRecord = {
              id: `absence-${item.id}-${dateKey}`,
              scheduleId: item.id,
              date: dateKey,
              status: "absent",
              pointsProcessed: true,
            };
            attendance.push(absentRecord);
            points -= MISSED_SESSION_DEDUCTION;
          } else if (!existingRecord.pointsProcessed) {
            if (existingRecord.status === "present") {
              points += ATTENDED_SESSION_RECOVERY;
            } else {
              points -= MISSED_SESSION_DEDUCTION;
            }
            existingRecord.pointsProcessed = true;
          }
        });
    }

    const finalPoints = clampStudyPoints(points);
    const nextProfile = {
      ...this.profile,
      studyPoints: finalPoints,
      studyTier: getStudyTier(finalPoints).name,
      lastPointsEvaluationDate: today.toISOString(),
      lowPointsAlertSent:
        this.profile.lowPointsAlertSent || finalPoints <= LOW_POINTS_THRESHOLD,
      accountDeletionWarning:
        this.profile.accountDeletionWarning || finalPoints <= 0,
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
    this.deleted = {
      modules: [],
      assessments: [],
      schedule: [],
      attendance: [],
    };
    this.settings = {};
    this.user = null;
    this.profile = null;
    this.pendingRemoteFileDeletions = [];

    try {
      const keys = [
        "modules",
        "files",
        "assessments",
        "schedule",
        "attendance",
        "deleted",
        "settings",
        "user",
        "profile",
        "pendingRemoteFileDeletions",
      ].map((key) => this.storageKey(key));
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.error(
        "Error clearing AsyncStorage:",
        error,
      );
    }
  }
}

export const store = new Store();