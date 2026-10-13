// src/context/StoreContext.tsx

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

import {
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
    uploadFileToDatabase,
} from "../lib/fileApi";
import { useAuth } from "./AuthContext";

interface StoreContextType {
  modules: Module[];
  assessments: Assessment[];
  files: FileItem[];
  schedule: ScheduleItem[];
  attendance: AttendanceRecord[];
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

  clearAllData: () => void;
}

const StoreContext = createContext<
  StoreContextType | undefined
>(undefined);

export const StoreProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { user: authUser } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [attendance, setAttendance] = useState<
    AttendanceRecord[]
  >([]);

  const [user, setUserState] = useState<User | null>(null);
  const [profile, setProfileState] =
    useState<UserProfile | null>(null);

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
        if (!authUser?.id) {
          setModules([]);
          setAssessments([]);
          setFiles([]);
          setSchedule([]);
          setAttendance([]);
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

        const loadedProfile = store.getProfile();
        const initializedProfile = loadedProfile
          ? store.initializeStudyPoints(loadedProfile)
          : null;

        if (initializedProfile) {
          store.setProfile(initializedProfile);
        }
        store.evaluateMissedSessions();

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
            if (file.remoteId || !file.uri) {
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
  };

  /*
   * ----------------------------------------------------------
   * ASSESSMENTS
   * ----------------------------------------------------------
   */

  const addAssessment = (assessment: Assessment) => {
    store.addAssessment(assessment);

    setAssessments(store.getAssessments());
  };

  const updateAssessment = (
    id: string,
    updates: Partial<Assessment>
  ) => {
    store.updateAssessment(id, updates);

    setAssessments(store.getAssessments());
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
  };

  const deleteScheduleItem = (id: string) => {
    store.deleteScheduleItem(id);

    setSchedule(store.getSchedule());
  };

  /*
   * ----------------------------------------------------------
   * ATTENDANCE
   * ----------------------------------------------------------
   */

  const addAttendance = (record: AttendanceRecord) => {
    store.addAttendance(record);

    setAttendance(store.getAttendance());
    setProfileState(store.getProfile());
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