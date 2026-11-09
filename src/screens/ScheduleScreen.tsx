import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../components/ButtomNav";
import { CustomCard } from "../components/CustomCard";
import { WebLayout } from "../components/WebLayout";
import { API_URL } from "../config/api";
import { useStore } from "../context/StoreContext";
import { generateModuleQuiz } from "../lib/quizApi";
import { Assessment } from "../lib/store";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];
const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
];

const TIME_PRESETS = [
  { start: "08:00", end: "10:00", label: "08:00 - 10:00" },
  { start: "10:00", end: "12:00", label: "10:00 - 12:00" },
  { start: "12:00", end: "14:00", label: "12:00 - 14:00" },
  { start: "14:00", end: "16:00", label: "14:00 - 16:00" },
  { start: "16:00", end: "18:00", label: "16:00 - 18:00" },
];

export function ScheduleScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const {
    files,
    modules,
    schedule,
    assessments,
    attendance,
    addScheduleItem,
    deleteScheduleItem,
    addAssessment,
    addAttendance,
  } = useStore();

  // Tab State
  const [activeTab, setActiveTab] = useState<"timetable" | "assessments">("timetable");
  const [selectedDay, setSelectedDay] = useState(0);

  // Timetable Modal States
  const [timetableModalVisible, setTimetableModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [newTimetableItem, setNewTimetableItem] = useState({
    title: "",
    moduleId: "",
    selectedDays: [0],
    startTime: "08:00",
    endTime: "10:00",
    color: COLORS[0],
  });

  // Assessment / Quiz Modal States
  const [assessmentModalVisible, setAssessmentModalVisible] = useState(false);
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedChapterFileIds, setSelectedChapterFileIds] = useState<string[]>([]);
  const [generatingAssessment, setGeneratingAssessment] = useState(false);

  // Custom Quiz Generation Options (Min 10, Max 20)
  const [selectedQuestionType, setSelectedQuestionType] = useState<"mcq_only" | "combination" | "open_ended_only">("mcq_only");
  const [selectedDifficulty, setSelectedDifficulty] = useState<"low" | "medium" | "high">("medium");
  const [questionCount, setQuestionCount] = useState<number>(10);

  // Date and Register helpers
  const todayDate = new Date();
  const todayKey = todayDate.toISOString().slice(0, 10);
  const todayDayOfWeek = (todayDate.getDay() + 6) % 7; // 0=Mon, ..., 6=Sun
  const todayAttendanceRecords = attendance.filter((a) => a.date === todayKey && a.status === "present");
  const isTodayRegistered = todayAttendanceRecords.length > 0;

  // Check if a module is present in the study timetable
  const isModuleInTimetable = (moduleId: string) => {
    return schedule.some((item) => item.moduleId === moduleId);
  };

  const handleSelectModule = (modId: string) => {
    setSelectedModule(modId);
    const modFiles = files.filter((f) => f.moduleId === modId);
    setSelectedChapterFileIds(modFiles.map((f) => f.remoteId || f.id));
  };

  const toggleChapterFile = (fileKey: string) => {
    if (selectedChapterFileIds.includes(fileKey)) {
      setSelectedChapterFileIds(selectedChapterFileIds.filter((id) => id !== fileKey));
    } else {
      setSelectedChapterFileIds([...selectedChapterFileIds, fileKey]);
    }
  };

  const selectAllChapters = () => {
    const modFiles = files.filter((f) => f.moduleId === selectedModule);
    setSelectedChapterFileIds(modFiles.map((f) => f.remoteId || f.id));
  };

  const clearAllChapters = () => {
    setSelectedChapterFileIds([]);
  };

  useEffect(() => {
    const params = (route.params as any) || {};
    if (params.tab === "assessments" || params.generate) {
      const timer = setTimeout(() => {
        setActiveTab("assessments");
        if (params.generate) {
          if (params.moduleId) {
            handleSelectModule(params.moduleId);
          }
          setAssessmentModalVisible(true);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [route.params]);

  // Calculate study performance
  const getStudyPerformance = () => {
    const completed = assessments.filter((a) => a.completed);
    if (completed.length === 0) return 0;
    const total = completed.reduce((sum, a) => sum + (a.score || 0), 0);
    return Math.round(total / completed.length);
  };

  // Calculate study sessions this month
  const getStudySessionsThisMonth = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const uniqueDays = new Set();
    attendance.forEach((a) => {
      if (a.status === "present" && a.date.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`)) {
        uniqueDays.add(a.date);
      }
    });

    schedule.forEach((s) => {
      uniqueDays.add(`${s.dayOfWeek}-${currentMonth}-${currentYear}`);
    });

    return Math.max(uniqueDays.size, attendance.filter((a) => a.status === "present").length);
  };

  // Get schedule items for selected day
  const getScheduleForDay = (dayIndex: number) => {
    return schedule.filter((s) => s.dayOfWeek === dayIndex);
  };

  const getModuleName = (moduleId: string) => {
    const module = modules.find((m) => m.id === moduleId);
    return module?.name || "Unknown Module";
  };

  // Open Timetable Modal with optional presets
  const openTimetableModal = (prefill?: { moduleId?: string; dayIndex?: number; startTime?: string; endTime?: string }) => {
    setEditingItem(null);
    const chosenDay = prefill?.dayIndex !== undefined ? prefill.dayIndex : selectedDay;
    const chosenModule = prefill?.moduleId || (modules.length > 0 ? modules[0].id : "");
    const mod = modules.find((m) => m.id === chosenModule);

    setNewTimetableItem({
      title: "",
      moduleId: chosenModule,
      selectedDays: [chosenDay],
      startTime: prefill?.startTime || "08:00",
      endTime: prefill?.endTime || "10:00",
      color: mod?.color || COLORS[0],
    });
    setTimetableModalVisible(true);
  };

  const handleAddSchedule = () => {
    if (!newTimetableItem.title.trim() || !newTimetableItem.moduleId || newTimetableItem.selectedDays.length === 0) {
      const msg = "Please enter a class title, select a module, and pick at least one study day.";
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.alert(msg);
      } else {
        Alert.alert("Missing Information", msg);
      }
      return;
    }

    const module = modules.find((m) => m.id === newTimetableItem.moduleId);
    const itemColor = module?.color || newTimetableItem.color || COLORS[0];

    if (editingItem) {
      deleteScheduleItem(editingItem.id);
      addScheduleItem({
        id: editingItem.id,
        title: newTimetableItem.title.trim(),
        moduleId: newTimetableItem.moduleId,
        dayOfWeek: newTimetableItem.selectedDays[0],
        startTime: newTimetableItem.startTime,
        endTime: newTimetableItem.endTime,
        color: itemColor,
        is_recurring: true,
      });
    } else {
      newTimetableItem.selectedDays.forEach((dayOfWeek, index) => {
        addScheduleItem({
          id: `${Date.now()}-${dayOfWeek}-${index}`,
          title: newTimetableItem.title.trim(),
          moduleId: newTimetableItem.moduleId,
          dayOfWeek,
          startTime: newTimetableItem.startTime,
          endTime: newTimetableItem.endTime,
          color: itemColor,
          is_recurring: true,
        });
      });
    }

    setTimetableModalVisible(false);
    setEditingItem(null);
    setNewTimetableItem({
      title: "",
      moduleId: "",
      selectedDays: [0],
      startTime: "08:00",
      endTime: "10:00",
      color: COLORS[0],
    });
  };

  const handleEditSchedule = (item: any) => {
    setEditingItem(item);
    setNewTimetableItem({
      title: item.title,
      moduleId: item.moduleId,
      selectedDays: [item.dayOfWeek],
      startTime: item.startTime,
      endTime: item.endTime,
      color: item.color,
    });
    setTimetableModalVisible(true);
  };

  const handleDeleteSchedule = (id: string, title: string) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`Are you sure you want to delete "${title}" from your timetable?`)) {
        deleteScheduleItem(id);
        if (editingItem?.id === id) {
          setTimetableModalVisible(false);
          setEditingItem(null);
        }
      }
    } else {
      Alert.alert("Delete Class", `Are you sure you want to delete "${title}" from your timetable?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteScheduleItem(id);
            if (editingItem?.id === id) {
              setTimetableModalVisible(false);
              setEditingItem(null);
            }
          },
        },
      ]);
    }
  };

  // Check if a time slot has a class
  const getClassForTimeSlot = (dayIndex: number, timeSlot: string) => {
    const daySchedule = getScheduleForDay(dayIndex);
    return daySchedule.find((s) => s.startTime === timeSlot);
  };

  // QUIZ GENERATION & REGISTER MARKING
  const handleGenerateAssessment = async () => {
    if (!selectedModule) {
      const msg = "Please select a module first.";
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.alert(msg);
      } else {
        Alert.alert("Module Required", msg);
      }
      return;
    }

    const module = modules.find((m) => m.id === selectedModule);
    if (!module) return;

    // RULE: Timetable is MUST before generating a quiz
    if (!isModuleInTimetable(selectedModule)) {
      const msg = `Timetable is required before generating a quiz. Please add "${module.name}" to your timetable first.`;
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          const addNow = window.confirm(`${msg}\n\nWould you like to add it to your timetable now?`);
          if (addNow) {
            setAssessmentModalVisible(false);
            openTimetableModal({ moduleId: selectedModule });
          }
        }
      } else {
        Alert.alert("Timetable Required", msg, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Add to Timetable",
            onPress: () => {
              setAssessmentModalVisible(false);
              openTimetableModal({ moduleId: selectedModule });
            },
          },
        ]);
      }
      return;
    }

    // RULE: Chapters (uploaded content) must be selected
    const moduleFiles = files.filter((f) => f.moduleId === selectedModule);
    if (moduleFiles.length > 0 && selectedChapterFileIds.length === 0) {
      const msg = "Please tick at least one chapter (uploaded content file) to include in your quiz.";
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.alert(msg);
      } else {
        Alert.alert("Chapters Required", msg);
      }
      return;
    }

    const finalCount = Math.min(Math.max(questionCount, 10), 20);

    setGeneratingAssessment(true);
    try {
      const questions = await generateModuleQuiz(selectedModule, module.name, {
        questionCount: finalCount,
        questionType: selectedQuestionType,
        difficulty: selectedDifficulty,
        fileIds: selectedChapterFileIds,
      });

      const typeLabel =
        selectedQuestionType === "mcq_only"
          ? "Multiple Choice"
          : selectedQuestionType === "open_ended_only"
            ? "Open Ended"
            : "Combination";

      const assessmentItem: Assessment = {
        id: Date.now().toString(),
        moduleId: selectedModule,
        type: "quiz",
        title: `${module.name} ${typeLabel} Quiz (${selectedDifficulty.toUpperCase()})`,
        questionCount: questions.length,
        completed: false,
        score: 0,
        questions,
      };

      addAssessment(assessmentItem);

      // MARK THE REGISTER: Generating a quiz after study session marks attendance for today
      const matchingSession =
        schedule.find((s) => s.moduleId === selectedModule && s.dayOfWeek === todayDayOfWeek) ||
        schedule.find((s) => s.moduleId === selectedModule);

      if (matchingSession) {
        addAttendance({
          id: `attendance-${matchingSession.id}-${todayKey}`,
          scheduleId: matchingSession.id,
          date: todayKey,
          status: "present",
        });

        // Sync directly to backend class_attendance endpoint
        try {
          const token = await AsyncStorage.getItem("authToken");
          if (token) {
            fetch(`${API_URL}/attendance`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                scheduleId: matchingSession.id,
                date: todayKey,
                status: "present",
              }),
            }).catch((err) => console.warn("Direct attendance sync notice:", err));
          }
        } catch (syncErr) {
          console.warn("Could not sync attendance:", syncErr);
        }
      }

      setAssessmentModalVisible(false);

      const chapterCountText = selectedChapterFileIds.length > 0 ? ` from ${selectedChapterFileIds.length} chapter(s)` : "";
      const successMsg = `Quiz generated successfully${chapterCountText}! Your study attendance register has been marked as PRESENT for today.`;

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.alert(successMsg);
      } else {
        Alert.alert("Register Marked & Quiz Generated! 🎓", successMsg);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Please upload readable study content first.";
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.alert(`Quiz generation failed: ${errMsg}`);
      } else {
        Alert.alert("Quiz generation failed", errMsg);
      }
    } finally {
      setGeneratingAssessment(false);
    }
  };

  /* =========================================================================
   * TIMETABLE MODAL (Shared for Web & Mobile)
   * ========================================================================= */
  const renderTimetableModal = () => (
    <Modal
      visible={timetableModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setTimetableModalVisible(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setTimetableModalVisible(false)}
      >
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{editingItem ? "Edit Class / Session" : "Add to Study Timetable"}</Text>
              <Text style={styles.modalSubHeader}>Set up your weekly study schedule to unlock AI quizzes</Text>
            </View>
            <TouchableOpacity onPress={() => setTimetableModalVisible(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Subject / Class Title */}
            <Text style={styles.modalLabel}>Class / Subject Name *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Data Structures & Algorithms"
              placeholderTextColor="#9ca3af"
              value={newTimetableItem.title}
              onChangeText={(text) => setNewTimetableItem({ ...newTimetableItem, title: text })}
            />

            {/* Select Module */}
            <Text style={styles.modalLabel}>Select Module *</Text>
            {modules.length === 0 ? (
              <View style={styles.noModulesWarning}>
                <Ionicons name="warning-outline" size={20} color="#f59e0b" />
                <Text style={styles.noModulesText}>No modules created yet. Please create a module first.</Text>
              </View>
            ) : (
              <View style={styles.moduleGridList}>
                {modules.map((m) => {
                  const isSelected = newTimetableItem.moduleId === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.moduleCardOption, isSelected && styles.moduleCardOptionSelected]}
                      onPress={() => {
                        setNewTimetableItem({
                          ...newTimetableItem,
                          moduleId: m.id,
                          color: m.color || COLORS[0],
                          title: newTimetableItem.title || m.name,
                        });
                      }}
                    >
                      <View style={[styles.moduleColorDot, { backgroundColor: m.color || "#6366f1" }]} />
                      <Text style={[styles.moduleCardText, isSelected && styles.moduleCardTextSelected]} numberOfLines={1}>
                        {m.name}
                      </Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={16} color="#6366f1" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Study Days Selector */}
            <Text style={styles.modalLabel}>Study Days (Select all that apply) *</Text>
            <Text style={styles.dayHelperText}>Choose which days this subject should appear on your timetable.</Text>
            <View style={styles.daySelectionRow}>
              {DAYS.map((day, index) => {
                const isDaySelected = newTimetableItem.selectedDays.includes(index);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, isDaySelected && styles.dayChipSelected]}
                    onPress={() => {
                      if (editingItem) {
                        setNewTimetableItem({ ...newTimetableItem, selectedDays: [index] });
                      } else {
                        const updatedDays = isDaySelected
                          ? newTimetableItem.selectedDays.filter((d) => d !== index)
                          : [...newTimetableItem.selectedDays, index].sort((a, b) => a - b);
                        setNewTimetableItem({ ...newTimetableItem, selectedDays: updatedDays });
                      }
                    }}
                  >
                    <Text style={[styles.dayChipText, isDaySelected && styles.dayChipTextSelected]}>{day}</Text>
                    {isDaySelected && <Ionicons name="checkmark" size={12} color="#4338ca" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Time Presets */}
            <Text style={styles.modalLabel}>Study Time Slot *</Text>
            <View style={styles.presetTimeRow}>
              {TIME_PRESETS.map((preset) => {
                const isPreset = newTimetableItem.startTime === preset.start && newTimetableItem.endTime === preset.end;
                return (
                  <TouchableOpacity
                    key={preset.label}
                    style={[styles.presetTimeBtn, isPreset && styles.presetTimeBtnActive]}
                    onPress={() => {
                      setNewTimetableItem({
                        ...newTimetableItem,
                        startTime: preset.start,
                        endTime: preset.end,
                      });
                    }}
                  >
                    <Text style={[styles.presetTimeText, isPreset && styles.presetTimeTextActive]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Time Row */}
            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Text style={styles.timeFieldLabel}>Start Time (HH:MM)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="08:00"
                  placeholderTextColor="#9ca3af"
                  value={newTimetableItem.startTime}
                  onChangeText={(text) => setNewTimetableItem({ ...newTimetableItem, startTime: text })}
                />
              </View>
              <View style={styles.timeField}>
                <Text style={styles.timeFieldLabel}>End Time (HH:MM)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="10:00"
                  placeholderTextColor="#9ca3af"
                  value={newTimetableItem.endTime}
                  onChangeText={(text) => setNewTimetableItem({ ...newTimetableItem, endTime: text })}
                />
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActionsRow}>
              {editingItem && (
                <TouchableOpacity
                  style={styles.deleteClassBtn}
                  onPress={() => handleDeleteSchedule(editingItem.id, editingItem.title)}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  <Text style={styles.deleteClassBtnText}>Delete</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!newTimetableItem.title.trim() || !newTimetableItem.moduleId || newTimetableItem.selectedDays.length === 0) &&
                    styles.saveButtonDisabled,
                ]}
                onPress={handleAddSchedule}
                disabled={!newTimetableItem.title.trim() || !newTimetableItem.moduleId || newTimetableItem.selectedDays.length === 0}
              >
                <Ionicons name="save-outline" size={18} color="white" />
                <Text style={styles.saveButtonText}>
                  {editingItem ? "Update Class" : "Save to Timetable"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  /* =========================================================================
   * ASSESSMENT / QUIZ GENERATION MODAL (Shared for Web & Mobile)
   * ========================================================================= */
  const renderAssessmentModal = () => {
    const selectedModObj = modules.find((m) => m.id === selectedModule);
    const modFiles = files.filter((f) => f.moduleId === selectedModule);
    const hasTimetable = selectedModule ? isModuleInTimetable(selectedModule) : false;

    return (
      <Modal
        visible={assessmentModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAssessmentModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAssessmentModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="sparkles" size={20} color="#4f46e5" />
                  <Text style={styles.modalTitle}>Generate AI Quiz</Text>
                </View>
                <Text style={styles.modalSubHeader}>
                  Generate quizzes after your study session to mark your daily attendance register!
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAssessmentModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Daily Register Notice */}
              <View style={styles.registerNoticeBanner}>
                <Ionicons name="calendar-outline" size={20} color="#1d4ed8" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.registerNoticeTitle}>Daily Attendance Register</Text>
                  <Text style={styles.registerNoticeText}>
                    Generating a quiz is the only action that marks your study register as PRESENT for today.
                    A timetable entry for the module is required.
                  </Text>
                </View>
              </View>

              {/* Step 1: Select Module */}
              <Text style={styles.modalLabel}>1. Select Module *</Text>
              {modules.length === 0 ? (
                <View style={styles.noModulesWarning}>
                  <Ionicons name="warning-outline" size={20} color="#f59e0b" />
                  <Text style={styles.noModulesText}>No modules available. Please add modules first.</Text>
                </View>
              ) : (
                <View style={styles.moduleGridList}>
                  {modules.map((m) => {
                    const isSelected = selectedModule === m.id;
                    const inTimetable = isModuleInTimetable(m.id);

                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[
                          styles.moduleCardOption,
                          isSelected && styles.moduleCardOptionSelected,
                          !inTimetable && styles.moduleOptionNoTimetable,
                        ]}
                        onPress={() => handleSelectModule(m.id)}
                      >
                        <View style={[styles.moduleColorDot, { backgroundColor: m.color || "#6366f1" }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.moduleCardText, isSelected && styles.moduleCardTextSelected]} numberOfLines={1}>
                            {m.name}
                          </Text>
                          <Text style={[styles.moduleTimetableTag, inTimetable ? styles.tagInTimetable : styles.tagNotInTimetable]}>
                            {inTimetable ? "✓ In Timetable" : "⚠ No Timetable"}
                          </Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark-circle" size={18} color="#6366f1" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Timetable Requirement Warning if module not on timetable */}
              {selectedModule && !hasTimetable && (
                <View style={styles.timetableRequiredCard}>
                  <Ionicons name="alert-circle" size={22} color="#dc2626" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timetableRequiredTitle}>Timetable Required</Text>
                    <Text style={styles.timetableRequiredText}>
                      "{selectedModObj?.name}" is not on your timetable yet. You must add it to your study timetable before you can generate a quiz.
                    </Text>
                    <TouchableOpacity
                      style={styles.addModuleToTimetableBtn}
                      onPress={() => {
                        setAssessmentModalVisible(false);
                        openTimetableModal({ moduleId: selectedModule });
                      }}
                    >
                      <Ionicons name="add-circle" size={16} color="white" />
                      <Text style={styles.addModuleToTimetableText}>Add "{selectedModObj?.name}" to Timetable</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Step 2: Choose Chapters (Content uploaded per module) */}
              {selectedModule && hasTimetable && (
                <View style={styles.chapterSectionContainer}>
                  <View style={styles.chapterSectionHeader}>
                    <View>
                      <Text style={styles.modalLabel}>2. Choose Chapters to Include *</Text>
                      <Text style={styles.chapterHelperText}>
                        Tick multiple chapters (uploaded materials) to test your knowledge.
                      </Text>
                    </View>

                    {modFiles.length > 0 && (
                      <View style={styles.chapterQuickActions}>
                        <TouchableOpacity onPress={selectAllChapters} style={styles.chapterQuickBtn}>
                          <Text style={styles.chapterQuickBtnText}>Select All</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={clearAllChapters} style={styles.chapterQuickBtn}>
                          <Text style={styles.chapterQuickBtnText}>Clear All</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {modFiles.length === 0 ? (
                    <View style={styles.noChaptersWarning}>
                      <Ionicons name="document-text-outline" size={28} color="#f59e0b" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.noChaptersTitle}>No Uploaded Chapters</Text>
                        <Text style={styles.noChaptersText}>
                          No study content has been uploaded for this module yet. Upload PDFs or notes in the Modules tab to generate quizzes.
                        </Text>
                        <TouchableOpacity
                          style={styles.goToModulesLink}
                          onPress={() => {
                            setAssessmentModalVisible(false);
                            navigation.navigate("Modules");
                          }}
                        >
                          <Text style={styles.goToModulesLinkText}>Go to Modules to Upload Content →</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.chapterListContainer}>
                      <Text style={styles.chapterCounterBadge}>
                        {selectedChapterFileIds.length} of {modFiles.length} chapter(s) selected
                      </Text>
                      {modFiles.map((file, idx) => {
                        const fileKey = file.remoteId || file.id;
                        const isChecked = selectedChapterFileIds.includes(fileKey);

                        return (
                          <TouchableOpacity
                            key={file.id}
                            style={[styles.chapterItemRow, isChecked && styles.chapterItemRowSelected]}
                            onPress={() => toggleChapterFile(fileKey)}
                          >
                            <Ionicons
                              name={isChecked ? "checkbox" : "square-outline"}
                              size={20}
                              color={isChecked ? "#4f46e5" : "#94a3b8"}
                            />
                            <View style={styles.chapterIconBox}>
                              <Ionicons name="document-text" size={16} color="#6366f1" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.chapterNameText, isChecked && styles.chapterNameTextSelected]} numberOfLines={1}>
                                {file.name}
                              </Text>
                              <Text style={styles.chapterMetaText}>
                                Chapter {idx + 1} • {file.type || "Document"}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* Step 3: Quiz Generation Options */}
              <Text style={styles.modalLabel}>3. Question Types *</Text>
              {[
                { id: "mcq_only", label: "Multiple Choice Questions Only" },
                { id: "combination", label: "Combination (MCQ & Open-Ended)" },
                { id: "open_ended_only", label: "Open-Ended Questions Only" },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.typeOption,
                    selectedQuestionType === opt.id && styles.typeOptionSelected,
                  ]}
                  onPress={() => setSelectedQuestionType(opt.id as any)}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      selectedQuestionType === opt.id && styles.typeOptionTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.modalLabel}>4. Difficulty Level *</Text>
              <View style={styles.difficultyRow}>
                {[
                  { id: "low", label: "Low (Easy)" },
                  { id: "medium", label: "Medium" },
                  { id: "high", label: "High (Challenging)" },
                ].map((diff) => (
                  <TouchableOpacity
                    key={diff.id}
                    style={[
                      styles.diffOption,
                      selectedDifficulty === diff.id && styles.diffOptionSelected,
                    ]}
                    onPress={() => setSelectedDifficulty(diff.id as any)}
                  >
                    <Text
                      style={[
                        styles.diffOptionText,
                        selectedDifficulty === diff.id && styles.diffOptionTextSelected,
                      ]}
                    >
                      {diff.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>5. Number of Questions (10 - 20) *</Text>
              <View style={styles.questionCountRow}>
                <TouchableOpacity
                  style={styles.countAdjustBtn}
                  onPress={() => setQuestionCount(Math.max(10, questionCount - 1))}
                >
                  <Ionicons name="remove" size={18} color="#0f172a" />
                </TouchableOpacity>
                <Text style={styles.countValueText}>{questionCount}</Text>
                <TouchableOpacity
                  style={styles.countAdjustBtn}
                  onPress={() => setQuestionCount(Math.min(20, questionCount + 1))}
                >
                  <Ionicons name="add" size={18} color="#0f172a" />
                </TouchableOpacity>
                <Text style={styles.countHintText}>Questions will be generated from selected chapters</Text>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.generateSubmitBtn,
                  (!selectedModule || !hasTimetable || (modFiles.length > 0 && selectedChapterFileIds.length === 0) || generatingAssessment) &&
                    styles.generateSubmitBtnDisabled,
                ]}
                onPress={handleGenerateAssessment}
                disabled={!selectedModule || !hasTimetable || (modFiles.length > 0 && selectedChapterFileIds.length === 0) || generatingAssessment}
              >
                {generatingAssessment ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <ActivityIndicator color="white" />
                    <Text style={styles.generateSubmitBtnText}>Generating AI Quiz & Registering...</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="sparkles" size={18} color="white" />
                    <Text style={styles.generateSubmitBtnText}>Generate Quiz & Mark Register</Text>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  /* =========================================================================
   * MOBILE TIMETABLE VIEW
   * ========================================================================= */
  const renderTimetable = () => (
    <>
      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Study Performance</Text>
          <Text style={styles.statValue}>{getStudyPerformance()}%</Text>
          <View style={styles.statProgress}>
            <View style={[styles.statProgressFill, { width: `${getStudyPerformance()}%` }]} />
          </View>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Study Sessions</Text>
          <Text style={styles.statValue}>{getStudySessionsThisMonth()}</Text>
          <Text style={styles.statSubLabel}>This month</Text>
        </View>
      </View>

      {/* Today's Register Status Card */}
      <View style={[styles.registerStatusBanner, isTodayRegistered ? styles.registerBannerSuccess : styles.registerBannerPending]}>
        <Ionicons
          name={isTodayRegistered ? "checkmark-circle" : "time-outline"}
          size={22}
          color={isTodayRegistered ? "#16a34a" : "#d97706"}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.registerBannerTitle}>
            {isTodayRegistered ? "Today's Study Register: PRESENT" : "Today's Study Register: PENDING"}
          </Text>
          <Text style={styles.registerBannerSub}>
            {isTodayRegistered
              ? "You generated a quiz and marked your register for today!"
              : "Generate a quiz after your study session to mark your daily register."}
          </Text>
        </View>
      </View>

      {/* Add Timetable Button */}
      <TouchableOpacity style={styles.addTimetableButton} onPress={() => openTimetableModal()}>
        <Ionicons name="add-circle-outline" size={24} color="#083b23ff" />
        <Text style={styles.addTimetableText}>Add to Timetable</Text>
      </TouchableOpacity>

      {/* Week Days Header */}
      <View style={styles.weekHeader}>
        {DAYS.map((day, index) => (
          <TouchableOpacity
            key={day}
            style={[styles.weekDay, selectedDay === index && styles.weekDaySelected]}
            onPress={() => setSelectedDay(index)}
          >
            <Text style={[styles.weekDayText, selectedDay === index && styles.weekDayTextSelected]}>
              {day}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Timetable Grid */}
      <View style={styles.timetableContainer}>
        <View style={styles.timetableGrid}>
          {/* Time Column */}
          <View style={styles.timeColumn}>
            {HOURS.map((hour) => (
              <View key={hour} style={styles.timeSlot}>
                <Text style={styles.timeText}>{hour}</Text>
              </View>
            ))}
          </View>

          {/* Schedule Column */}
          <View style={styles.scheduleColumn}>
            {HOURS.map((hour) => {
              const classItem = getClassForTimeSlot(selectedDay, hour);
              const hasClass = !!classItem;

              return (
                <View key={hour} style={styles.scheduleSlot}>
                  {hasClass ? (
                    <TouchableOpacity
                      style={[styles.classBlock, { backgroundColor: classItem.color + "20" }]}
                      onPress={() => handleEditSchedule(classItem)}
                      onLongPress={() => handleDeleteSchedule(classItem.id, classItem.title)}
                    >
                      <View style={[styles.classColorBar, { backgroundColor: classItem.color }]} />
                      <View style={styles.classContent}>
                        <Text style={styles.classTitle}>{classItem.title}</Text>
                        <Text style={styles.classModule}>{getModuleName(classItem.moduleId)}</Text>
                        <Text style={styles.classTime}>
                          {classItem.startTime} - {classItem.endTime}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.classEditButton} onPress={() => handleEditSchedule(classItem)}>
                        <Ionicons name="create-outline" size={16} color={classItem.color} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.emptyMobileSlot}
                      onPress={() => openTimetableModal({ dayIndex: selectedDay, startTime: hour })}
                    >
                      <Ionicons name="add" size={14} color="#cbd5e1" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </>
  );

  /* =========================================================================
   * MOBILE ASSESSMENTS VIEW
   * ========================================================================= */
  const renderAssessments = () => (
    <>
      {/* Assessment Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Average Score</Text>
          <Text style={styles.statValue}>{getStudyPerformance()}%</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Completed</Text>
          <Text style={styles.statValue}>{assessments.filter((a) => a.completed).length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{assessments.length}</Text>
        </View>
      </View>

      {/* Today's Register Status Card */}
      <View style={[styles.registerStatusBanner, isTodayRegistered ? styles.registerBannerSuccess : styles.registerBannerPending]}>
        <Ionicons
          name={isTodayRegistered ? "checkmark-circle" : "time-outline"}
          size={22}
          color={isTodayRegistered ? "#16a34a" : "#d97706"}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.registerBannerTitle}>
            {isTodayRegistered ? "Daily Register: MARKED FOR TODAY" : "Daily Register: PENDING"}
          </Text>
          <Text style={styles.registerBannerSub}>
            {isTodayRegistered
              ? "Your attendance is registered for today."
              : "Generate a quiz after your study session to mark your register."}
          </Text>
        </View>
      </View>

      {/* Generate Assessment Button */}
      <TouchableOpacity
        style={styles.generateButton}
        onPress={() => {
          if (schedule.length === 0) {
            Alert.alert(
              "Timetable Required",
              "You must create your study timetable before you can generate quizzes. Please set up your timetable first.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Create Timetable", onPress: () => openTimetableModal() },
              ]
            );
            return;
          }
          setAssessmentModalVisible(true);
        }}
      >
        <Ionicons name="sparkles" size={24} color="#1d3a1aff" />
        <Text style={styles.generateButtonText}>Generate AI Quiz from Chapters</Text>
      </TouchableOpacity>

      {/* Assessment List */}
      {assessments.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="clipboard-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyStateTitle}>No Assessments Yet</Text>
          <Text style={styles.emptyStateText}>
            Generate your first AI quiz from module chapters after studying to test your knowledge!
          </Text>
        </View>
      ) : (
        assessments.map((assessment) => {
          const module = modules.find((m) => m.id === assessment.moduleId);
          return (
            <CustomCard key={assessment.id} style={styles.assessmentCard}>
              <View style={styles.assessmentHeader}>
                <View style={styles.assessmentInfo}>
                  <View style={styles.assessmentTitleRow}>
                    <Ionicons name="sparkles" size={16} color="#134926ff" />
                    <Text style={styles.assessmentTitle}>{assessment.title}</Text>
                  </View>
                  <Text style={styles.assessmentModule}>{module?.name}</Text>
                  <Text style={styles.assessmentQuestions}>{assessment.questionCount} questions</Text>
                </View>
                {assessment.completed ? (
                  <View style={styles.completedContainer}>
                    <Ionicons name="checkmark-circle" size={32} color="#10b981" />
                    <Text style={styles.completedText}>{assessment.score}%</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.startButton}
                    onPress={() => (navigation.navigate as any)("Quiz", { id: assessment.id })}
                  >
                    <Text style={styles.startButtonText}>Start</Text>
                  </TouchableOpacity>
                )}
              </View>
            </CustomCard>
          );
        })
      )}
    </>
  );

  /* =========================================================================
   * WEB PLATFORM VIEW
   * ========================================================================= */
  if (Platform.OS === "web") {
    return (
      <WebLayout>
        <ScrollView style={styles.webScheduleScroll} contentContainerStyle={styles.webScheduleContent} showsVerticalScrollIndicator={false}>
          {/* TOP HEADER & ACTION BAR */}
          <View style={styles.webScheduleHeaderRow}>
            <View>
              <Text style={styles.webScheduleTitle}>Schedule & Timetable</Text>
              <Text style={styles.webScheduleSubtitle}>
                Manage your weekly study timetable, generate chapter quizzes, and track your daily register
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              {/* Generate Quiz Button in Header */}
              <TouchableOpacity
                style={styles.webGenerateHeaderBtn}
                onPress={() => {
                  if (schedule.length === 0) {
                    if (typeof window !== "undefined") {
                      window.alert("Timetable Required: You must create your study timetable before you can generate quizzes. Please set up your timetable first.");
                    }
                    openTimetableModal();
                    return;
                  }
                  setAssessmentModalVisible(true);
                }}
              >
                <Ionicons name="sparkles" size={17} color="white" />
                <Text style={styles.webAddClassText}>Generate Quiz</Text>
              </TouchableOpacity>

              {/* Add to Timetable Button in Header */}
              <TouchableOpacity style={styles.webAddClassBtn} onPress={() => openTimetableModal()}>
                <Ionicons name="add-circle" size={18} color="white" />
                <Text style={styles.webAddClassText}>Add to Timetable</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* METRICS ROW */}
          <View style={styles.webMetricsRow}>
            <View style={styles.webMetricCard}>
              <View style={styles.webMetricIconBox}>
                <Ionicons name="trending-up" size={20} color="#10b981" />
              </View>
              <View>
                <Text style={styles.webMetricLabel}>Study Performance</Text>
                <Text style={styles.webMetricValue}>{getStudyPerformance()}%</Text>
              </View>
            </View>

            <View style={styles.webMetricCard}>
              <View style={styles.webMetricIconBox}>
                <Ionicons name="calendar-outline" size={20} color="#6366f1" />
              </View>
              <View>
                <Text style={styles.webMetricLabel}>Sessions this Month</Text>
                <Text style={styles.webMetricValue}>{getStudySessionsThisMonth()}</Text>
              </View>
            </View>

            <View style={styles.webMetricCard}>
              <View style={styles.webMetricIconBox}>
                <Ionicons name="ribbon-outline" size={20} color="#f59e0b" />
              </View>
              <View>
                <Text style={styles.webMetricLabel}>Completed Assessments</Text>
                <Text style={styles.webMetricValue}>{assessments.filter((a) => a.completed).length}</Text>
              </View>
            </View>

            {/* Daily Register Status Card */}
            <View style={[styles.webMetricCard, isTodayRegistered ? styles.webMetricCardActive : {}]}>
              <View style={[styles.webMetricIconBox, { backgroundColor: isTodayRegistered ? "#dcfce7" : "#fef3c7" }]}>
                <Ionicons
                  name={isTodayRegistered ? "checkmark-circle" : "time-outline"}
                  size={20}
                  color={isTodayRegistered ? "#16a34a" : "#d97706"}
                />
              </View>
              <View>
                <Text style={styles.webMetricLabel}>Today's Register</Text>
                <Text style={[styles.webMetricValue, { color: isTodayRegistered ? "#16a34a" : "#d97706", fontSize: 16 }]}>
                  {isTodayRegistered ? "Present ✓" : "Pending"}
                </Text>
              </View>
            </View>
          </View>

          {/* TAB SWITCHER */}
          <View style={styles.webTabSwitcherRow}>
            <TouchableOpacity
              style={[styles.webTabBtn, activeTab === "timetable" && styles.webTabBtnActive]}
              onPress={() => setActiveTab("timetable")}
            >
              <Ionicons name="calendar" size={17} color={activeTab === "timetable" ? "#6366f1" : "#64748b"} />
              <Text style={[styles.webTabBtnText, activeTab === "timetable" && styles.webTabBtnTextActive]}>
                Weekly Timetable Grid
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.webTabBtn, activeTab === "assessments" && styles.webTabBtnActive]}
              onPress={() => setActiveTab("assessments")}
            >
              <Ionicons name="clipboard" size={17} color={activeTab === "assessments" ? "#6366f1" : "#64748b"} />
              <Text style={[styles.webTabBtnText, activeTab === "assessments" && styles.webTabBtnTextActive]}>
                Assessments & Quizzes
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: WEEKLY TIMETABLE GRID */}
          {activeTab === "timetable" ? (
            <View style={styles.webGridCard}>
              <View style={styles.webGridHeaderRow}>
                <View style={styles.webTimeHeaderCol}>
                  <Text style={styles.webGridHeaderDayText}>TIME</Text>
                </View>
                {DAYS.map((day) => (
                  <View key={day} style={styles.webGridDayHeaderCol}>
                    <Text style={styles.webGridHeaderDayText}>{day.toUpperCase()}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.webGridBody}>
                {HOURS.map((hour) => (
                  <View key={hour} style={styles.webGridRow}>
                    <View style={styles.webTimeCol}>
                      <Text style={styles.webTimeColText}>{hour}</Text>
                    </View>

                    {DAYS.map((day, dayIndex) => {
                      const classItem = getClassForTimeSlot(dayIndex, hour);
                      return (
                        <TouchableOpacity
                          key={`${dayIndex}-${hour}`}
                          style={[styles.webGridSlot, classItem && { backgroundColor: `${classItem.color}15` }]}
                          onPress={() => {
                            if (classItem) {
                              handleEditSchedule(classItem);
                            } else {
                              openTimetableModal({ dayIndex, startTime: hour });
                            }
                          }}
                        >
                          {classItem ? (
                            <View style={[styles.webClassCardBlock, { borderLeftColor: classItem.color }]}>
                              <Text style={styles.webClassTitleText} numberOfLines={1}>{classItem.title}</Text>
                              <Text style={styles.webClassModuleText} numberOfLines={1}>{getModuleName(classItem.moduleId)}</Text>
                              <Text style={styles.webClassTimeText}>{classItem.startTime} - {classItem.endTime}</Text>
                            </View>
                          ) : (
                            <View style={styles.webEmptySlotHover}>
                              <Ionicons name="add-outline" size={14} color="#cbd5e1" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          ) : (
            /* TAB 2: ASSESSMENTS & QUIZZES */
            <View style={styles.webAssessmentsContainer}>
              {/* Prominent Quiz Generation Card */}
              <View style={styles.webQuizBannerCard}>
                <View style={styles.webQuizBannerContent}>
                  <View style={styles.webQuizBannerBadge}>
                    <Ionicons name="sparkles" size={15} color="#4f46e5" />
                    <Text style={styles.webQuizBannerBadgeText}>AI Knowledge Check</Text>
                  </View>
                  <Text style={styles.webQuizBannerTitle}>Generate Quiz after Study Session</Text>
                  <Text style={styles.webQuizBannerSub}>
                    Choose your module, tick the chapters (uploaded content) you studied, and test your knowledge.
                    Generating a quiz marks your daily study register!
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.webQuizBannerBtn}
                  onPress={() => {
                    if (schedule.length === 0) {
                      if (typeof window !== "undefined") {
                        window.alert("Timetable Required: You must create your study timetable before you can generate quizzes. Please set up your timetable first.");
                      }
                      openTimetableModal();
                      return;
                    }
                    setAssessmentModalVisible(true);
                  }}
                >
                  <Ionicons name="sparkles" size={18} color="white" />
                  <Text style={styles.webQuizBannerBtnText}>Generate Quiz</Text>
                </TouchableOpacity>
              </View>

              {/* Today's Register Status Card on Web */}
              <View style={[styles.webRegisterCard, isTodayRegistered ? styles.webRegisterCardSuccess : styles.webRegisterCardPending]}>
                <Ionicons
                  name={isTodayRegistered ? "checkmark-circle" : "time-outline"}
                  size={24}
                  color={isTodayRegistered ? "#16a34a" : "#d97706"}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.webRegisterCardTitle}>
                    {isTodayRegistered ? "Today's Study Register: MARKED PRESENT ✓" : "Today's Study Register: PENDING"}
                  </Text>
                  <Text style={styles.webRegisterCardSub}>
                    {isTodayRegistered
                      ? "Great work! You generated a quiz and marked your study register for today."
                      : "Study your scheduled module and generate a quiz to mark your register for today."}
                  </Text>
                </View>
              </View>

              {/* Assessment Grid List */}
              {assessments.length === 0 ? (
                <View style={styles.webEmptyStateCard}>
                  <Ionicons name="clipboard-outline" size={48} color="#94a3b8" />
                  <Text style={styles.webEmptyStateTitle}>No Assessments Yet</Text>
                  <Text style={styles.webEmptyStateSub}>
                    Quizzes generated from your study modules and chapters will appear here.
                  </Text>
                  <TouchableOpacity
                    style={styles.webEmptyStateBtn}
                    onPress={() => {
                      if (schedule.length === 0) {
                        if (typeof window !== "undefined") {
                          window.alert("Please set up your study timetable first.");
                        }
                        openTimetableModal();
                        return;
                      }
                      setAssessmentModalVisible(true);
                    }}
                  >
                    <Ionicons name="sparkles" size={16} color="white" />
                    <Text style={styles.webEmptyStateBtnText}>Generate First Quiz</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.webAssessmentsGrid}>
                  {assessments.map((a) => (
                    <View key={a.id} style={styles.webAssessmentCard}>
                      <View style={styles.webAssessmentHeader}>
                        <Text style={styles.webAssessmentTitle} numberOfLines={2}>{a.title}</Text>
                        <View style={[styles.webScoreBadge, { backgroundColor: a.completed ? "#dcfce7" : "#fef3c7" }]}>
                          <Text style={[styles.webScoreText, { color: a.completed ? "#166534" : "#92400e" }]}>
                            {a.completed ? `${a.score || 0}%` : "Pending"}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.webAssessmentMeta}>
                        {a.questionCount || a.questions?.length || 10} Questions • {getModuleName(a.moduleId)}
                      </Text>
                      <TouchableOpacity
                        style={styles.webStartQuizBtn}
                        onPress={() => navigation.navigate("Quiz", { id: a.id })}
                      >
                        <Text style={styles.webStartQuizText}>{a.completed ? "Review Assessment" : "Start Quiz"}</Text>
                        <Ionicons name="arrow-forward" size={14} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* RENDER MODALS ON WEB */}
          {renderTimetableModal()}
          {renderAssessmentModal()}
        </ScrollView>
      </WebLayout>
    );
  }

  /* =========================================================================
   * MOBILE PLATFORM VIEW
   * ========================================================================= */
  return (
    <WebLayout>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Schedule</Text>
          <Text style={styles.headerSubtitle}>
            {activeTab === "timetable"
              ? "Your weekly study timetable"
              : "AI quizzes & daily study register"}
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "timetable" && styles.tabButtonActive]}
            onPress={() => setActiveTab("timetable")}
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color={activeTab === "timetable" ? "#185516ff" : "#6b7280"}
            />
            <Text style={[styles.tabButtonText, activeTab === "timetable" && styles.tabButtonTextActive]}>
              Timetable
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === "assessments" && styles.tabButtonActive]}
            onPress={() => setActiveTab("assessments")}
          >
            <Ionicons
              name="clipboard-outline"
              size={20}
              color={activeTab === "assessments" ? "#45cf53ff" : "#6b7280"}
            />
            <Text style={[styles.tabButtonText, activeTab === "assessments" && styles.tabButtonTextActive]}>
              Assessments & Quizzes
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {activeTab === "timetable" ? renderTimetable() : renderAssessments()}
          <View style={styles.bottomPadding} />
        </ScrollView>

        {/* RENDER MODALS ON MOBILE */}
        {renderTimetableModal()}
        {renderAssessmentModal()}

        <BottomNav />
      </SafeAreaView>
    </WebLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    alignItems: Platform.OS === "web" ? "center" : "stretch",
  },
  header: {
    width: "100%",
    maxWidth: Platform.OS === "web" ? 1200 : "100%",
    alignSelf: "center",
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  tabContainer: {
    width: "100%",
    maxWidth: Platform.OS === "web" ? 1200 : "100%",
    alignSelf: "center",
    flexDirection: "row",
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    gap: 12,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#2a6f22ff",
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  tabButtonTextActive: {
    color: "#15803d",
  },
  scrollContent: {
    width: "100%",
    maxWidth: Platform.OS === "web" ? 1200 : "100%",
    alignSelf: "center",
    padding: 16,
    paddingBottom: 0,
  },
  bottomPadding: {
    height: 80,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  statValue: {
    fontSize: 26,
    fontWeight: "700",
    color: "#16a34a",
    marginTop: 4,
  },
  statSubLabel: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  statProgress: {
    height: 4,
    backgroundColor: "#e5e7eb",
    borderRadius: 2,
    marginTop: 8,
    overflow: "hidden",
  },
  statProgressFill: {
    height: "100%",
    backgroundColor: "#22c55e",
    borderRadius: 2,
  },
  registerStatusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  registerBannerSuccess: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  registerBannerPending: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  registerBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  registerBannerSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  addTimetableButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "white",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#15af36ff",
    borderStyle: "dashed",
  },
  addTimetableText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#15803d",
  },
  weekHeader: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  weekDay: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  weekDaySelected: {
    backgroundColor: "#22c55e",
  },
  weekDayText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6b7280",
  },
  weekDayTextSelected: {
    color: "white",
    fontWeight: "600",
  },
  timetableContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  timetableGrid: {
    flexDirection: "row",
  },
  timeColumn: {
    width: 60,
    backgroundColor: "#f9fafb",
    paddingTop: 4,
  },
  timeSlot: {
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  timeText: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "500",
  },
  scheduleColumn: {
    flex: 1,
  },
  scheduleSlot: {
    height: 80,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    padding: 4,
    position: "relative",
  },
  emptyMobileSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.3,
  },
  classBlock: {
    flex: 1,
    borderRadius: 8,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  classColorBar: {
    width: 4,
    height: "100%",
    borderRadius: 2,
    marginRight: 8,
  },
  classContent: {
    flex: 1,
  },
  classTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  classModule: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 1,
  },
  classTime: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 1,
  },
  classEditButton: {
    padding: 4,
    alignSelf: "flex-start",
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "white",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#16a34a",
    borderStyle: "dashed",
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#16a34a",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    backgroundColor: "white",
    borderRadius: 12,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  assessmentCard: {
    padding: 16,
    backgroundColor: "white",
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  assessmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  assessmentInfo: {
    flex: 1,
    gap: 4,
  },
  assessmentTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  assessmentTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  assessmentModule: {
    fontSize: 13,
    color: "#6b7280",
  },
  assessmentQuestions: {
    fontSize: 12,
    color: "#9ca3af",
  },
  completedContainer: {
    alignItems: "center",
    gap: 4,
  },
  completedText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10b981",
  },
  startButton: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  startButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },

  /* MODAL STYLES (Responsive Web + Mobile) */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: Platform.OS === "web" ? "center" : "flex-end",
    alignItems: Platform.OS === "web" ? "center" : "stretch",
    padding: Platform.OS === "web" ? 20 : 0,
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: Platform.OS === "web" ? 16 : 24,
    borderTopRightRadius: Platform.OS === "web" ? 16 : 24,
    borderRadius: Platform.OS === "web" ? 16 : 0,
    maxHeight: Platform.OS === "web" ? "88%" : "85%",
    width: Platform.OS === "web" ? "100%" : "auto",
    maxWidth: Platform.OS === "web" ? 580 : "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalSubHeader: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    maxWidth: 440,
  },
  modalCloseBtn: {
    padding: 4,
    borderRadius: 6,
  },
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#f8fafc",
    color: "#0f172a",
    marginBottom: 16,
  },

  /* Timetable Module Grid & Days */
  moduleGridList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  moduleCardOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    minWidth: 140,
    flex: 1,
  },
  moduleCardOptionSelected: {
    borderColor: "#6366f1",
    backgroundColor: "#eef2ff",
  },
  moduleOptionNoTimetable: {
    opacity: 0.9,
  },
  moduleCardText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  moduleCardTextSelected: {
    color: "#4338ca",
  },
  moduleColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  moduleTimetableTag: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: "600",
  },
  tagInTimetable: {
    color: "#16a34a",
  },
  tagNotInTimetable: {
    color: "#d97706",
  },
  daySelectionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
  },
  dayHelperText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: -4,
    marginBottom: 10,
  },
  dayChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  dayChipSelected: {
    borderColor: "#6366f1",
    backgroundColor: "#eef2ff",
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  dayChipTextSelected: {
    color: "#4338ca",
  },
  presetTimeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  presetTimeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  presetTimeBtnActive: {
    backgroundColor: "#eef2ff",
    borderColor: "#6366f1",
  },
  presetTimeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  presetTimeTextActive: {
    color: "#4338ca",
  },
  timeRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  timeField: {
    flex: 1,
  },
  timeFieldLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
    fontWeight: "500",
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 8,
  },
  deleteClassBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  deleteClassBtnText: {
    color: "#ef4444",
    fontWeight: "600",
    fontSize: 14,
  },
  saveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6366f1",
    paddingVertical: 12,
    borderRadius: 10,
  },
  saveButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  saveButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },

  /* Register Notice Banner inside Quiz Modal */
  registerNoticeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    marginBottom: 16,
  },
  registerNoticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e40af",
  },
  registerNoticeText: {
    fontSize: 12,
    color: "#1e3a8a",
    marginTop: 2,
    lineHeight: 16,
  },
  timetableRequiredCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    marginBottom: 16,
  },
  timetableRequiredTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#b91c1c",
  },
  timetableRequiredText: {
    fontSize: 12,
    color: "#991b1b",
    marginTop: 2,
    marginBottom: 8,
  },
  addModuleToTimetableBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "#dc2626",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addModuleToTimetableText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },

  /* Chapter Selection Styles */
  chapterSectionContainer: {
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#f8fafc",
  },
  chapterSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  chapterHelperText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: -4,
  },
  chapterQuickActions: {
    flexDirection: "row",
    gap: 8,
  },
  chapterQuickBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#eef2ff",
  },
  chapterQuickBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4f46e5",
  },
  chapterCounterBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4f46e5",
    marginBottom: 8,
  },
  chapterListContainer: {
    gap: 6,
  },
  chapterItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "white",
  },
  chapterItemRowSelected: {
    borderColor: "#4f46e5",
    backgroundColor: "#eef2ff",
  },
  chapterIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  chapterNameText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  chapterNameTextSelected: {
    color: "#3730a3",
  },
  chapterMetaText: {
    fontSize: 11,
    color: "#64748b",
  },
  noChaptersWarning: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  noChaptersTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400e",
  },
  noChaptersText: {
    fontSize: 12,
    color: "#b45309",
    marginTop: 2,
    lineHeight: 16,
  },
  goToModulesLink: {
    marginTop: 6,
  },
  goToModulesLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6366f1",
  },

  /* Quiz Generation Types & Difficulty */
  typeOption: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    marginBottom: 6,
  },
  typeOptionSelected: {
    borderColor: "#4f46e5",
    backgroundColor: "#eef2ff",
  },
  typeOptionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#334155",
  },
  typeOptionTextSelected: {
    color: "#4338ca",
    fontWeight: "700",
  },
  difficultyRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  diffOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  diffOptionSelected: {
    borderColor: "#4f46e5",
    backgroundColor: "#eef2ff",
  },
  diffOptionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  diffOptionTextSelected: {
    color: "#4338ca",
    fontWeight: "700",
  },
  questionCountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  countAdjustBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  countValueText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    minWidth: 32,
    textAlign: "center",
  },
  countHintText: {
    fontSize: 11,
    color: "#64748b",
    flex: 1,
  },
  generateSubmitBtn: {
    backgroundColor: "#4f46e5",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  generateSubmitBtnDisabled: {
    backgroundColor: "#94a3b8",
  },
  generateSubmitBtnText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },

  /* WEB SCHEDULE MATRIX STYLES */
  webScheduleScroll: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  webScheduleContent: {
    padding: 24,
    maxWidth: 1300,
    width: "100%",
    alignSelf: "center",
    gap: 20,
  },
  webScheduleHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  webScheduleTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  webScheduleSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  webGenerateHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#4f46e5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    cursor: "pointer" as any,
  },
  webAddClassBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#059669",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    cursor: "pointer" as any,
  },
  webAddClassText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },
  webMetricsRow: {
    flexDirection: "row",
    gap: 16,
  },
  webMetricCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  webMetricCardActive: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  webMetricIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  webMetricLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  webMetricValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 2,
  },
  webTabSwitcherRow: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 4,
    gap: 4,
    alignSelf: "flex-start",
  },
  webTabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    cursor: "pointer" as any,
  },
  webTabBtnActive: {
    backgroundColor: "#eef2ff",
  },
  webTabBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  webTabBtnTextActive: {
    color: "#6366f1",
  },
  webGridCard: {
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  webGridHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  webTimeHeaderCol: {
    width: 70,
    paddingVertical: 12,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
  },
  webGridDayHeaderCol: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#f1f5f9",
  },
  webGridHeaderDayText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.5,
  },
  webGridBody: {
    display: "flex",
    flexDirection: "column",
  },
  webGridRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    minHeight: 58,
  },
  webTimeCol: {
    width: 70,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fafafa",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
  },
  webTimeColText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  webGridSlot: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: "#f1f5f9",
    padding: 4,
    cursor: "pointer" as any,
  },
  webClassCardBlock: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 6,
    borderLeftWidth: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  webClassTitleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  webClassModuleText: {
    fontSize: 11,
    color: "#64748b",
  },
  webClassTimeText: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 1,
  },
  webEmptySlotHover: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.3,
  },

  /* WEB ASSESSMENTS VIEW STYLES */
  webAssessmentsContainer: {
    gap: 16,
  },
  webQuizBannerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e0e7ff",
    padding: 20,
    gap: 20,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  webQuizBannerContent: {
    flex: 1,
    gap: 6,
  },
  webQuizBannerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#eef2ff",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  webQuizBannerBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4f46e5",
  },
  webQuizBannerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  webQuizBannerSub: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },
  webQuizBannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#4f46e5",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    cursor: "pointer" as any,
  },
  webQuizBannerBtnText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },
  webRegisterCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  webRegisterCardSuccess: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  webRegisterCardPending: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  webRegisterCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  webRegisterCardSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  webAssessmentsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  webEmptyStateCard: {
    width: "100%",
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 40,
    alignItems: "center",
    gap: 10,
  },
  webEmptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  webEmptyStateSub: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 420,
  },
  webEmptyStateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#4f46e5",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 6,
    cursor: "pointer" as any,
  },
  webEmptyStateBtnText: {
    color: "white",
    fontWeight: "700",
    fontSize: 13,
  },
  webAssessmentCard: {
    width: "48%",
    minWidth: 320,
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 18,
    gap: 12,
  },
  webAssessmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  webAssessmentTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
    lineHeight: 20,
  },
  webScoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  webScoreText: {
    fontSize: 12,
    fontWeight: "700",
  },
  webAssessmentMeta: {
    fontSize: 12,
    color: "#64748b",
  },
  webStartQuizBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#6366f1",
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
    cursor: "pointer" as any,
  },
  webStartQuizText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },
  noModulesWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    marginBottom: 16,
  },
  noModulesText: {
    flex: 1,
    fontSize: 13,
    color: "#92400e",
  },
});
