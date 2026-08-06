import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import {
  Alert,
  Modal,
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
import { useStore } from "../context/StoreContext";
import { Assessment } from "../lib/store";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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

export function ScheduleScreen() {
  const navigation = useNavigation();
  const {
    modules,
    schedule,
    assessments,
    addScheduleItem,
    deleteScheduleItem,
    addAssessment,
  } = useStore();

  // States
  const [activeTab, setActiveTab] = useState<"timetable" | "assessments">(
    "timetable",
  );
  const [selectedDay, setSelectedDay] = useState(0);

  // Timetable Modal States
  const [timetableModalVisible, setTimetableModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [newTimetableItem, setNewTimetableItem] = useState({
    title: "",
    moduleId: "",
    dayOfWeek: 0,
    startTime: "08:00",
    endTime: "10:00",
    color: COLORS[0],
  });

  // Assessment Modal States
  const [assessmentModalVisible, setAssessmentModalVisible] = useState(false);
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedType, setSelectedType] = useState<
    "quiz" | "test" | "mock_exam"
  >("quiz");

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
    assessments.forEach((a) => {
      if (a.completed) {
        uniqueDays.add(`${currentMonth}-${currentYear}`);
      }
    });

    schedule.forEach((s) => {
      uniqueDays.add(`${s.dayOfWeek}-${currentMonth}-${currentYear}`);
    });

    return uniqueDays.size || 0;
  };

  // Get schedule items for selected day
  const getScheduleForDay = (dayIndex: number) => {
    return schedule.filter((s) => s.dayOfWeek === dayIndex);
  };

  const getModuleName = (moduleId: string) => {
    const module = modules.find((m) => m.id === moduleId);
    return module?.name || "Unknown Module";
  };

  const handleAddSchedule = () => {
    if (!newTimetableItem.title || !newTimetableItem.moduleId) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    const module = modules.find((m) => m.id === newTimetableItem.moduleId);
    const scheduleItem = {
      id: editingItem?.id || Date.now().toString(),
      ...newTimetableItem,
      color: module?.color || COLORS[0],
      is_recurring: true,
    };

    if (editingItem) {
      deleteScheduleItem(editingItem.id);
      addScheduleItem(scheduleItem);
    } else {
      addScheduleItem(scheduleItem);
    }

    setTimetableModalVisible(false);
    setEditingItem(null);
    setNewTimetableItem({
      title: "",
      moduleId: "",
      dayOfWeek: 0,
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
      dayOfWeek: item.dayOfWeek,
      startTime: item.startTime,
      endTime: item.endTime,
      color: item.color,
    });
    setTimetableModalVisible(true);
  };

  const handleDeleteSchedule = (id: string, title: string) => {
    Alert.alert("Delete Class", `Are you sure you want to delete "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteScheduleItem(id),
      },
    ]);
  };

  // Check if a time slot has a class
  const getClassForTimeSlot = (dayIndex: number, timeSlot: string) => {
    const daySchedule = getScheduleForDay(dayIndex);
    return daySchedule.find((s) => s.startTime === timeSlot);
  };

  const handleGenerateAssessment = () => {
    if (!selectedModule) {
      Alert.alert("Error", "Please select a module");
      return;
    }

    const module = modules.find((m) => m.id === selectedModule);
    if (!module) return;

    const questionCounts = {
      quiz: 10,
      test: 25,
      mock_exam: 50,
    };

    const assessmentItem: Assessment = {
      id: Date.now().toString(),
      moduleId: selectedModule,
      type: selectedType,
      title: `${module.name} ${selectedType.replace("_", " ").toUpperCase()}`,
      questionCount: questionCounts[selectedType],
      completed: false,
      score: 0,
    };

    addAssessment(assessmentItem);
    setAssessmentModalVisible(false);
    Alert.alert("Success", "Assessment generated successfully!");
  };

  const renderTimetable = () => (
    <>
      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Study Performance</Text>
          <Text style={styles.statValue}>{getStudyPerformance()}%</Text>
          <View style={styles.statProgress}>
            <View
              style={[
                styles.statProgressFill,
                { width: `${getStudyPerformance()}%` },
              ]}
            />
          </View>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Study Sessions</Text>
          <Text style={styles.statValue}>{getStudySessionsThisMonth()}</Text>
          <Text style={styles.statSubLabel}>This month</Text>
        </View>
      </View>

      {/* Add Timetable Button */}
      <TouchableOpacity
        style={styles.addTimetableButton}
        onPress={() => {
          setEditingItem(null);
          setNewTimetableItem({
            title: "",
            moduleId: "",
            dayOfWeek: 0,
            startTime: "08:00",
            endTime: "10:00",
            color: COLORS[0],
          });
          setTimetableModalVisible(true);
        }}
      >
        <Ionicons name="add-circle-outline" size={24} color="#6366f1" />
        <Text style={styles.addTimetableText}>Add to Timetable</Text>
      </TouchableOpacity>

      {/* Week Days Header */}
      <View style={styles.weekHeader}>
        {DAYS.map((day, index) => (
          <TouchableOpacity
            key={day}
            style={[
              styles.weekDay,
              selectedDay === index && styles.weekDaySelected,
            ]}
            onPress={() => setSelectedDay(index)}
          >
            <Text
              style={[
                styles.weekDayText,
                selectedDay === index && styles.weekDayTextSelected,
              ]}
            >
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
                  {hasClass && (
                    <TouchableOpacity
                      style={[
                        styles.classBlock,
                        { backgroundColor: classItem.color + "20" },
                      ]}
                      onPress={() => handleEditSchedule(classItem)}
                      onLongPress={() =>
                        handleDeleteSchedule(classItem.id, classItem.title)
                      }
                    >
                      <View
                        style={[
                          styles.classColorBar,
                          { backgroundColor: classItem.color },
                        ]}
                      />
                      <View style={styles.classContent}>
                        <Text style={styles.classTitle}>{classItem.title}</Text>
                        <Text style={styles.classModule}>
                          {getModuleName(classItem.moduleId)}
                        </Text>
                        <Text style={styles.classTime}>
                          {classItem.startTime} - {classItem.endTime}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.classEditButton}
                        onPress={() => handleEditSchedule(classItem)}
                      >
                        <Ionicons
                          name="create-outline"
                          size={16}
                          color={classItem.color}
                        />
                      </TouchableOpacity>
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
          <Text style={styles.statValue}>
            {assessments.filter((a) => a.completed).length}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{assessments.length}</Text>
        </View>
      </View>

      {/* Generate Assessment Button */}
      <TouchableOpacity
        style={styles.generateButton}
        onPress={() => setAssessmentModalVisible(true)}
      >
        <Ionicons name="sparkles" size={24} color="#6366f1" />
        <Text style={styles.generateButtonText}>Generate AI Assessment</Text>
      </TouchableOpacity>

      {/* Assessment List */}
      {assessments.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="clipboard-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyStateTitle}>No Assessments Yet</Text>
          <Text style={styles.emptyStateText}>
            Generate your first AI assessment to test your knowledge
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
                    <Ionicons name="sparkles" size={16} color="#6366f1" />
                    <Text style={styles.assessmentTitle}>
                      {assessment.title}
                    </Text>
                  </View>
                  <Text style={styles.assessmentModule}>{module?.name}</Text>
                  <Text style={styles.assessmentQuestions}>
                    {assessment.questionCount} questions
                  </Text>
                </View>
                {assessment.completed ? (
                  <View style={styles.completedContainer}>
                    <Ionicons
                      name="checkmark-circle"
                      size={32}
                      color="#10b981"
                    />
                    <Text style={styles.completedText}>
                      {assessment.score}%
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.startButton}
                    onPress={() =>
                      (navigation.navigate as any)("Quiz", {
                        id: assessment.id,
                      })
                    }
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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Schedule</Text>
        <Text style={styles.headerSubtitle}>
          {activeTab === "timetable"
            ? "Your weekly study timetable"
            : "AI-powered assessments"}
        </Text>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "timetable" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("timetable")}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={activeTab === "timetable" ? "#6366f1" : "#6b7280"}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "timetable" && styles.tabButtonTextActive,
            ]}
          >
            Timetable
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "assessments" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("assessments")}
        >
          <Ionicons
            name="clipboard-outline"
            size={20}
            color={activeTab === "assessments" ? "#6366f1" : "#6b7280"}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "assessments" && styles.tabButtonTextActive,
            ]}
          >
            Assessments
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "timetable" ? renderTimetable() : renderAssessments()}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Timetable Modal */}
      <Modal
        visible={timetableModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setTimetableModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTimetableModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingItem ? "Edit Timetable Entry" : "Add to Timetable"}
              </Text>
              <TouchableOpacity onPress={() => setTimetableModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalLabel}>Class Title</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., Data Structures"
                value={newTimetableItem.title}
                onChangeText={(text) =>
                  setNewTimetableItem({ ...newTimetableItem, title: text })
                }
              />

              <Text style={styles.modalLabel}>Select Module</Text>
              {modules.length === 0 ? (
                <View style={styles.noModulesWarning}>
                  <Ionicons name="warning-outline" size={24} color="#f59e0b" />
                  <Text style={styles.noModulesText}>
                    No modules created yet. Please create a module first.
                  </Text>
                </View>
              ) : (
                <View style={styles.moduleList}>
                  {modules.map((module) => (
                    <TouchableOpacity
                      key={module.id}
                      style={[
                        styles.moduleOption,
                        newTimetableItem.moduleId === module.id &&
                          styles.moduleOptionSelected,
                      ]}
                      onPress={() =>
                        setNewTimetableItem({
                          ...newTimetableItem,
                          moduleId: module.id,
                        })
                      }
                    >
                      <View
                        style={[
                          styles.moduleColorDot,
                          { backgroundColor: module.color },
                        ]}
                      />
                      <Text style={styles.moduleOptionText}>{module.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.modalLabel}>Day of Week</Text>
              <View style={styles.dayList}>
                {DAYS.map((day, index) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayOption,
                      newTimetableItem.dayOfWeek === index &&
                        styles.dayOptionSelected,
                    ]}
                    onPress={() =>
                      setNewTimetableItem({
                        ...newTimetableItem,
                        dayOfWeek: index,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.dayOptionText,
                        newTimetableItem.dayOfWeek === index &&
                          styles.dayOptionTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.timeRow}>
                <View style={styles.timeField}>
                  <Text style={styles.modalLabel}>Start Time</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="08:00"
                    value={newTimetableItem.startTime}
                    onChangeText={(text) =>
                      setNewTimetableItem({
                        ...newTimetableItem,
                        startTime: text,
                      })
                    }
                  />
                </View>
                <View style={styles.timeField}>
                  <Text style={styles.modalLabel}>End Time</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="10:00"
                    value={newTimetableItem.endTime}
                    onChangeText={(text) =>
                      setNewTimetableItem({
                        ...newTimetableItem,
                        endTime: text,
                      })
                    }
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  !newTimetableItem.moduleId && styles.saveButtonDisabled,
                ]}
                onPress={handleAddSchedule}
                disabled={!newTimetableItem.moduleId}
              >
                <Text style={styles.saveButtonText}>
                  {editingItem ? "Update" : "Add to Schedule"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Assessment Modal */}
      <Modal
        visible={assessmentModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAssessmentModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAssessmentModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Generate AI Assessment</Text>
              <TouchableOpacity
                onPress={() => setAssessmentModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Select Module</Text>
              <View style={styles.moduleList}>
                {modules.map((module) => (
                  <TouchableOpacity
                    key={module.id}
                    style={[
                      styles.moduleOption,
                      selectedModule === module.id &&
                        styles.moduleOptionSelected,
                    ]}
                    onPress={() => setSelectedModule(module.id)}
                  >
                    <View
                      style={[
                        styles.moduleColorDot,
                        { backgroundColor: module.color },
                      ]}
                    />
                    <Text style={styles.moduleOptionText}>{module.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Assessment Type</Text>
              {(["quiz", "test", "mock_exam"] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeOption,
                    selectedType === type && styles.typeOptionSelected,
                  ]}
                  onPress={() => setSelectedType(type)}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      selectedType === type && styles.typeOptionTextSelected,
                    ]}
                  >
                    {type === "quiz"
                      ? "Quiz (10 questions)"
                      : type === "test"
                        ? "Test (25 questions)"
                        : "Mock Exam (50 questions)"}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  !selectedModule && styles.saveButtonDisabled,
                ]}
                onPress={handleGenerateAssessment}
                disabled={!selectedModule}
              >
                <Text style={styles.saveButtonText}>Generate Assessment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  header: {
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
    borderColor: "#6366f1",
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  tabButtonTextActive: {
    color: "#6366f1",
  },
  scrollContent: {
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
    fontSize: 28,
    fontWeight: "700",
    color: "#6366f1",
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
    backgroundColor: "#6366f1",
    borderRadius: 2,
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
    borderColor: "#6366f1",
    borderStyle: "dashed",
  },
  addTimetableText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6366f1",
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
    backgroundColor: "#6366f1",
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
    borderColor: "#6366f1",
    borderStyle: "dashed",
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6366f1",
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
    backgroundColor: "#6366f1",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  startButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: "#f9fafb",
    color: "#111827",
    marginBottom: 16,
  },
  moduleList: {
    gap: 8,
    marginBottom: 16,
  },
  moduleOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#f9fafb",
  },
  moduleOptionSelected: {
    borderColor: "#6366f1",
    backgroundColor: "#eef2ff",
  },
  moduleColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  moduleOptionText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
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
  dayList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  dayOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
  },
  dayOptionSelected: {
    borderColor: "#6366f1",
    backgroundColor: "#eef2ff",
  },
  dayOptionText: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  dayOptionTextSelected: {
    color: "#6366f1",
  },
  timeRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  timeField: {
    flex: 1,
  },
  typeOption: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#f9fafb",
    marginBottom: 8,
  },
  typeOptionSelected: {
    borderColor: "#6366f1",
    backgroundColor: "#eef2ff",
  },
  typeOptionText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
  },
  typeOptionTextSelected: {
    color: "#6366f1",
  },
  saveButton: {
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#9ca3af",
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
