// src/context/StoreContext.tsx

import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { AppState as RNAppState } from "react-native";

import {
    AppState,
    Assessment,
    AttendanceRecord,
    FileItem,
    Module,
    ScheduleItem,
    store,
    User,
    UserProfile,
} from "../lib/store";
import {
    deleteFileFromDatabase,
    fetchUserFiles,
    isSupportedStudyFile,
    uploadFileToDatabase,
} from "../lib/fileApi";
import { fetchAppState, saveAppState } from "../lib/appStateApi";
import {
  cancelStudyReminders,
  sendUserNotification,
  syncStudyReminders,
} from "../lib/notificationService";
import { useAuth } from "./AuthContext";

interface StoreContextType {
  modules: Module[];
  assessments: Assessment[];
  files: FileItem[];
  schedule: ScheduleItem[];
  attendance: AttendanceRecord[];
  settings: Record<string, unknown>;
  user: User | null;
  profile: UserProfile | null;

  addModule: (module: Module) => void;
  deleteModule: (id: string) => void;

  addAssessment: (assessment: Assessment) => void;
  updateAssessment: (
    id: string,
    updates: Partial<Assessment>
  ) => void;

  addFile: (file: FileItem) => void;
  deleteFile: (id: string) => void;
  setFileRemoteId: (fileId: string, remoteId: string) => Promise<void>;
  queueRemoteFileDeletion: (remoteId: string) => Promise<void>;
  clearQueuedRemoteFileDeletion: (remoteId: string) => Promise<void>;

  addScheduleItem: (item: ScheduleItem) => void;
  deleteScheduleItem: (id: string) => void;

  addAttendance: (record: AttendanceRecord) => void;

  setUser: (user: User) => void;
  setProfile: (profile: UserProfile) => void;
  setSettings: (settings: Record<string, unknown>) => void;

  clearAllData: () => void;
}

const StoreContext = createContext<
  StoreContextType | undefined
>(undefined);

const mergeRecords = <T extends { id: string }>(
  localRecords: T[],
  remoteRecords: T[],
): T[] => {
  const records = new Map(localRecords.map((record) => [record.id, record]));
  remoteRecords.forEach((record) => {
    records.set(record.id, { ...records.get(record.id), ...record });
  });
  return [...records.values()];
};

const mergeAppState = (local: AppState, remote: AppState): AppState => {
  const deleted: AppState["deleted"] = {
    modules: [...new Set([...local.deleted.modules, ...remote.deleted.modules])],
    assessments: [
      ...new Set([...local.deleted.assessments, ...remote.deleted.assessments]),
    ],
    schedule: [...new Set([...local.deleted.schedule, ...remote.deleted.schedule])],
    attendance: [
      ...new Set([...local.deleted.attendance, ...remote.deleted.attendance]),
    ],
  };

  return {
    modules: mergeRecords(local.modules, remote.modules).filter(
      (record) => !deleted.modules.includes(record.id),
    ),
    assessments: mergeRecords(local.assessments, remote.assessments).filter(
      (record) => !deleted.assessments.includes(record.id),
    ),
    schedule: mergeRecords(local.schedule, remote.schedule).filter(
      (record) => !deleted.schedule.includes(record.id),
    ),
    attendance: mergeRecords(local.attendance, remote.attendance).filter(
      (record) => !deleted.attendance.includes(record.id),
    ),
    deleted,
    profile: local.profile || remote.profile
      ? { ...local.profile, ...remote.profile }
      : null,
    settings: { ...local.settings, ...remote.settings },
  };
};

export const StoreProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { user: authUser, deleteAccount } = useAuth();
  const deleteAccountRef = useRef(deleteAccount);
  useEffect(() => {
    deleteAccountRef.current = deleteAccount;
  }, [deleteAccount]);
  const [modules, setModules] = useState<Module[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [attendance, setAttendance] = useState<
    AttendanceRecord[]
  >([]);
  const [settings, setSettingsState] = useState<Record<string, unknown>>({});

  const [user, setUserState] = useState<User | null>(null);
  const [profile, setProfileState] =
    useState<UserProfile | null>(null);
  const syncQueue = useRef<Promise<void>>(Promise.resolve());
  const loadedUserIdRef = useRef<string | null>(null);
  const settingsRef = useRef(settings);
  const lastDeletionAttemptRef = useRef<{
    userId: string;
    timestamp: number;
  } | null>(null);
  const pointsSyncPendingRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const notifyUser = async (title: string, body: string): Promise<boolean> => {
    if (settingsRef.current.notificationsEnabled !== true) {
      return false;
    }

    try {
      return await sendUserNotification(title, body);
    } catch (error) {
      console.error(`Could not send notification "${title}":`, error);
      return false;
    }
  };

  const queueAppStateSync = () => {
    const state = store.getAppState();
    const queuedSync = syncQueue.current
      .catch((error) => {
        console.error("Previous StudyMate data sync failed:", error);
      })
      .then(() => saveAppState(state));

    syncQueue.current = queuedSync;
    void queuedSync.catch((error) => {
      console.error("Could not sync StudyMate data to the server:", error);
    });
  };

  useEffect(() => {
    let disposed = false;
    let cancelScheduledReminders: (() => Promise<void>) | undefined;

    if (!authUser?.id || settings.notificationsEnabled !== true) {
      void cancelStudyReminders().catch((error) => {
        console.error("Could not cancel study reminders:", error);
      });
      return;
    }

    void syncStudyReminders(schedule)
      .then((cancel) => {
        if (disposed) {
          void cancel().catch((error) => {
            console.error("Could not update study reminders:", error);
          });
        } else {
          cancelScheduledReminders = cancel;
        }
      })
      .catch((error) => {
        console.error("Could not schedule study reminders:", error);
      });

    return () => {
      disposed = true;
      if (cancelScheduledReminders) {
        void cancelScheduledReminders().catch((error) => {
          console.error("Could not cancel study reminders:", error);
        });
      }
    };
  }, [authUser?.id, schedule, settings.notificationsEnabled]);

  const processPointEvaluationRef = useRef<() => Promise<void>>(
    async () => {},
  );
  const pointEvaluationInProgressRef = useRef(false);
  const runPointEvaluation = async () => {
    if (pointEvaluationInProgressRef.current) {
      return;
    }
    pointEvaluationInProgressRef.current = true;

    try {
      const evaluation = store.evaluateMissedSessions();
      if (!evaluation) {
        return;
      }

      if (evaluation.profile.studyPoints === 0) {
        const lastAttempt = lastDeletionAttemptRef.current;
        if (
          loadedUserIdRef.current &&
          lastAttempt?.userId === loadedUserIdRef.current &&
          Date.now() - lastAttempt.timestamp < 5 * 60 * 1000
        ) {
          return;
        }
        if (loadedUserIdRef.current) {
          lastDeletionAttemptRef.current = {
            userId: loadedUserIdRef.current,
            timestamp: Date.now(),
          };
        }
      }

      const needsSync =
        evaluation.missedSessions.length > 0 ||
        evaluation.pointsChanged ||
        evaluation.lowPointsReached ||
        evaluation.deletionThresholdReached;

      if (evaluation.missedSessions.length) {
        const missedCount = evaluation.missedSessions.length;
        await notifyUser(
          "Register marked absent",
          `You missed ${missedCount} study session${missedCount === 1 ? "" : "s"}. ${evaluation.deductedPoints} points were deducted. Balance: ${evaluation.profile.studyPoints} points.`,
        );
      }

      if (evaluation.lowPointsReached) {
        const notificationSent = await notifyUser(
          "Study points are low",
          `You have ${evaluation.profile.studyPoints} points. If your balance reaches 0, your account and data will be permanently deleted.`,
        );
        if (notificationSent) {
          const profileWithAlert = {
            ...evaluation.profile,
            lowPointsNotificationSent: true,
          };
          store.setProfile(profileWithAlert);
          setProfileState(profileWithAlert);
        }
      }

      if (evaluation.deletionThresholdReached) {
        await notifyUser(
          "Account deletion threshold reached",
          "Your study points reached 0. Your account and data will be permanently deleted.",
        );
      }

      if (needsSync || pointsSyncPendingRef.current || evaluation.profile.studyPoints === 0) {
        setAttendance(store.getAttendance());
        setProfileState(store.getProfile());
        pointsSyncPendingRef.current = true;
        try {
          await saveAppState(store.getAppState());
          pointsSyncPendingRef.current = false;
        } catch (error) {
          console.error("Could not save attendance and points updates:", error);
          if (evaluation.profile.studyPoints === 0) {
            await notifyUser(
              "Account deletion is pending",
              "Your balance reached 0, but the account could not be deleted yet. Reopen StudyMate when you have an internet connection to retry.",
            );
            return;
          }
        }
      }

      if (evaluation.profile.studyPoints === 0) {
        try {
          const cleanupWarnings = await deleteAccountRef.current();
          await notifyUser(
            "StudyMate account deleted",
            cleanupWarnings.length
              ? "Your account was permanently deleted, but some uploaded files need manual cleanup."
              : "Your account and StudyMate data were permanently deleted.",
          );
          await store.clearAllData();
          await cancelStudyReminders().catch((error) => {
            console.error("Could not cancel reminders during account deletion:", error);
          });
          setModules([]);
          setAssessments([]);
          setFiles([]);
          setSchedule([]);
          setAttendance([]);
          setSettingsState({});
          setUserState(null);
          setProfileState(null);
          loadedUserIdRef.current = null;
          cleanupWarnings.forEach((warning) => {
            console.warn("Account deletion cleanup warning:", warning);
          });
        } catch (error) {
          console.error("Could not permanently delete the zero-point account:", error);
          await notifyUser(
            "Account deletion is pending",
            `Your balance reached 0, but account deletion failed: ${error instanceof Error ? error.message : "unknown error"}. Reopen StudyMate to retry.`,
          );
        }
      }
    } finally {
      pointEvaluationInProgressRef.current = false;
    }
  };

  useEffect(() => {
    processPointEvaluationRef.current = runPointEvaluation;
  });

  useEffect(() => {
    if (!authUser?.id) {
      loadedUserIdRef.current = null;
      return;
    }

    const evaluateWhileActive = () => {
      if (
        RNAppState.currentState === "active" &&
        loadedUserIdRef.current === authUser.id
      ) {
        void processPointEvaluationRef.current().catch((error) => {
          console.error("Could not evaluate missed study sessions:", error);
        });
      }
    };

    const subscription = RNAppState.addEventListener("change", (state) => {
      if (state === "active") {
        evaluateWhileActive();
      }
    });
    const interval = setInterval(evaluateWhileActive, 60_000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [authUser?.id]);

  /*
   * ----------------------------------------------------------
   * LOAD SAVED DATA
   * ----------------------------------------------------------
   *
   * The Store class loads AsyncStorage asynchronously.
   *
   * Therefore, we MUST wait for that process to finish before
   * reading modules, files, assessments, etc.
   *
   * Without this wait, the application could read [] before
   * AsyncStorage has finished loading the user's saved data.
   */

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        loadedUserIdRef.current = null;
        if (!authUser?.id) {
          setModules([]);
          setAssessments([]);
          setFiles([]);
          setSchedule([]);
          setAttendance([]);
          setSettingsState({});
          setUserState(null);
          setProfileState(null);
          return;
        }

        await store.loadForUser(authUser.id);

        /*
         * The component may have been unmounted while the
         * AsyncStorage data was loading.
         *
         * Do not update state if that happened.
         */
        if (!mounted) {
          return;
        }

        try {
          const localState = store.getAppState();
          const remoteState = await fetchAppState();
          const mergedState = remoteState
            ? mergeAppState(localState, remoteState)
            : localState;

          if (!mounted) {
            return;
          }

          store.replaceAppState(mergedState);
          await saveAppState(mergedState);
        } catch (syncError) {
          console.error("Could not load or sync StudyMate data:", syncError);
        }

        const loadedProfile = store.getProfile();
        const initializedProfile = loadedProfile
          ? store.initializeStudyPoints(loadedProfile)
          : null;

        if (initializedProfile) {
          store.setProfile(initializedProfile);
        }
        settingsRef.current = store.getSettings();
        setSettingsState(settingsRef.current);
        loadedUserIdRef.current = authUser.id;
        await processPointEvaluationRef.current();
        if (authUser.id !== loadedUserIdRef.current) {
          return;
        }

        try {
          for (const remoteId of store.getPendingRemoteFileDeletions()) {
            try {
              await deleteFileFromDatabase(remoteId);
              await store.removePendingRemoteFileDeletion(remoteId);
            } catch (deleteError) {
              console.warn(
                "Could not finish deleting a remote file:",
                deleteError,
              );
            }
          }

          const remoteFiles = await fetchUserFiles();
          const modulesById = new Map(
            store.getModules().map((module) => [module.id, module]),
          );
          const moduleNames = new Set(
            store.getModules().map((module) => module.name),
          );

          remoteFiles.forEach((file, index) => {
            const name = file.moduleName || `Module ${index + 1}`;
            if (modulesById.has(file.moduleId) || moduleNames.has(name)) {
              return;
            }

            const module = {
              id: file.moduleId,
              name,
              color: ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6"][index % 4],
              icon: "book",
              fileCount: 0,
            };
            modulesById.set(module.id, module);
            moduleNames.add(module.name);
            store.addModule(module);
          });

          for (const file of store.getFiles()) {
            if (
              file.remoteId ||
              !file.uri ||
              !isSupportedStudyFile(file.name)
            ) {
              continue;
            }
            try {
              const uploadedFile = await uploadFileToDatabase({
                moduleId: file.moduleId,
                moduleName: store.getModules().find(
                  (module) => module.id === file.moduleId,
                )?.name,
                uri: file.uri,
                name: file.name,
                type: file.type,
                size: file.size,
              });
              await store.setFileRemoteId(file.id, uploadedFile.remoteId);
            } catch (uploadError) {
              console.warn(
                `Could not sync local file "${file.name}" to the database:`,
                uploadError,
              );
            }
          }

          const moduleByName = new Map(store.getModules().map((module) => [module.name, module]));
          store.mergeRemoteFiles(
            remoteFiles
              .filter(
                (file) =>
                  !store.getPendingRemoteFileDeletions().includes(
                    file.remoteId || file.id,
                  ),
              )
              .map((file) => ({
                ...file,
                id: file.id,
                remoteId: file.remoteId || file.id,
                uri: file.uri || file.url || "",
                uploadedAt:
                  file.uploadedAt || file.createdAt || new Date().toISOString(),
                moduleId:
                  moduleByName.get(file.moduleName || "")?.id || file.moduleId,
              })),
          );
        } catch (syncError) {
          console.warn("Could not sync database files on login:", syncError);
        }

        setModules(store.getModules());
        setAssessments(store.getAssessments());
        setFiles(store.getFiles());
        setSchedule(store.getSchedule());
        setAttendance(store.getAttendance());
        setUserState(store.getUser());
        setProfileState(store.getProfile());
      } catch (error) {
        console.error(
          "Error loading StoreContext data:",
          error
        );
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [authUser?.id]);

  /*
   * ----------------------------------------------------------
   * MODULES
   * ----------------------------------------------------------
   */

  const addModule = (module: Module) => {
    store.addModule(module);

    setModules(store.getModules());
    queueAppStateSync();
  };

  const deleteModule = (id: string) => {
    store.deleteModule(id);

    /*
     * Deleting a module also deletes its files and assessments
     * inside store.ts, so refresh all three pieces of state.
     */
    setModules(store.getModules());
    setFiles(store.getFiles());
    setAssessments(store.getAssessments());
    queueAppStateSync();
  };

  /*
   * ----------------------------------------------------------
   * ASSESSMENTS
   * ----------------------------------------------------------
   */

  const addAssessment = (assessment: Assessment) => {
    store.addAssessment(assessment);

    setAssessments(store.getAssessments());
    queueAppStateSync();
  };

  const updateAssessment = (
    id: string,
    updates: Partial<Assessment>
  ) => {
    store.updateAssessment(id, updates);

    setAssessments(store.getAssessments());
    queueAppStateSync();
  };

  /*
   * ----------------------------------------------------------
   * FILES
   * ----------------------------------------------------------
   */

  const addFile = (file: FileItem) => {
    store.addFile(file);

    /*
     * store.addFile() also updates the module's fileCount.
     *
     * Therefore we refresh BOTH files and modules here.
     */
    setFiles(store.getFiles());
    setModules(store.getModules());
  };

  const deleteFile = (id: string) => {
    store.deleteFile(id);

    /*
     * store.deleteFile() also recalculates the module's
     * fileCount.
     */
    setFiles(store.getFiles());
    setModules(store.getModules());
  };

  const setFileRemoteId = async (fileId: string, remoteId: string) => {
    await store.setFileRemoteId(fileId, remoteId);
    setFiles(store.getFiles());
  };

  const queueRemoteFileDeletion = (remoteId: string) => {
    return store.addPendingRemoteFileDeletion(remoteId);
  };

  const clearQueuedRemoteFileDeletion = (remoteId: string) => {
    return store.removePendingRemoteFileDeletion(remoteId);
  };

  /*
   * ----------------------------------------------------------
   * SCHEDULE
   * ----------------------------------------------------------
   */

  const addScheduleItem = (item: ScheduleItem) => {
    store.addScheduleItem(item);

    setSchedule(store.getSchedule());
    queueAppStateSync();
  };

  const deleteScheduleItem = (id: string) => {
    store.deleteScheduleItem(id);

    setSchedule(store.getSchedule());
    queueAppStateSync();
  };

  /*
   * ----------------------------------------------------------
   * ATTENDANCE
   * ----------------------------------------------------------
   */

  const addAttendance = (record: AttendanceRecord) => {
    const result = store.addAttendance(record);

    setAttendance(store.getAttendance());
    setProfileState(store.getProfile());
    queueAppStateSync();

    if (result.changed) {
      const session = schedule.find((item) => item.id === record.scheduleId);
      const status = record.status === "present" ? "PRESENT" : "ABSENT";
      const pointsText = result.pointsRecovered > 0
        ? ` You recovered ${result.pointsRecovered} points.`
        : "";
      void notifyUser(
        `Register marked ${status}`,
        `${session?.title || "Your study session"} was marked ${status}.${pointsText}`,
      );
    }
  };

  /*
   * ----------------------------------------------------------
   * USER
   * ----------------------------------------------------------
   */

  const setUser = (newUser: User) => {
    store.setUser(newUser);

    setUserState(newUser);
  };

  /*
   * ----------------------------------------------------------
   * PROFILE
   * ----------------------------------------------------------
   */

  const setProfile = (newProfile: UserProfile) => {
    const initializedProfile = store.initializeStudyPoints(newProfile);
    store.setProfile(initializedProfile);

    setProfileState(initializedProfile);
    queueAppStateSync();
  };

  const setSettings = (newSettings: Record<string, unknown>) => {
    store.setSettings(newSettings);
    setSettingsState(store.getSettings());
    queueAppStateSync();
  };

  /*
   * ----------------------------------------------------------
   * CLEAR ALL DATA
   * ----------------------------------------------------------
   */

  const clearAllData = () => {
    /*
     * store.clearAllData() is async in the updated store.
     *
     * We intentionally don't need to await it here because
     * the UI can be cleared immediately.
     */
    void store.clearAllData();

    setModules([]);
    setAssessments([]);
    setFiles([]);
    setSchedule([]);
    setAttendance([]);
    setSettingsState({});

    setUserState(null);
    setProfileState(null);
  };

  /*
   * ----------------------------------------------------------
   * PROVIDER
   * ----------------------------------------------------------
   */

  return (
    <StoreContext.Provider
      value={{
        modules,
        assessments,
        files,
        schedule,
        attendance,
        settings,

        user,
        profile,

        addModule,
        deleteModule,

        addAssessment,
        updateAssessment,

        addFile,
        deleteFile,
        setFileRemoteId,
        queueRemoteFileDeletion,
        clearQueuedRemoteFileDeletion,

        addScheduleItem,
        deleteScheduleItem,

        addAttendance,

        setUser,
        setProfile,
        setSettings,

        clearAllData,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

/*
 * ------------------------------------------------------------
 * useStore HOOK
 * ------------------------------------------------------------
 */

export const useStore = (): StoreContextType => {
  const context = useContext(StoreContext);

  if (context === undefined) {
    throw new Error(
      "useStore must be used within a StoreProvider"
    );
  }

  return context;
};