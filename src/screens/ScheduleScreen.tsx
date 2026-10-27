import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useEffect, useState } from "react";
import {
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
import { useStore } from "../context/StoreContext";
import { generateModuleQuiz } from "../lib/quizApi";
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
  const navigation = useNavigation<any>();
  const route = useRoute();
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
    selectedDays: [0],
    startTime: "08:00",
    endTime: "10:00",
    color: COLORS[0],
  });

  // Assessment Modal States
  const [assessmentModalVisible, setAssessmentModalVisible] = useState(false);
  const [selectedModule, setSelectedModule] = useState("");
  const [generatingAssessment, setGeneratingAssessment] = useState(false);

  // Custom Quiz Generation Options (Min 10, Max 20)
  const [selectedQuestionType, setSelectedQuestionType] = useState<"mcq_only" | "combination" | "open_ended_only">("mcq_only");
  const [selectedDifficulty, setSelectedDifficulty] = useState<"low" | "medium" | "high">("medium");
  const [questionCount, setQuestionCount] = useState<number>(10);

  useEffect(() => {
    const params = (route.params as any) || {};
    if (params.tab === "assessments" || params.generate) {
      const timer = setTimeout(() => {
        setActiveTab("assessments");
        if (params.generate) {
          if (params.moduleId) {
            setSelectedModule(params.moduleId);
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
    if (!newTimetableItem.title || !newTimetableItem.moduleId || newTimetableItem.selectedDays.length === 0) {
      Alert.alert("Error", "Please select a module and at least one study day");
      return;
    }

    const module = modules.find((m) => m.id === newTimetableItem.moduleId);

    if (editingItem) {
      deleteScheduleItem(editingItem.id);
      addScheduleItem({
        id: editingItem.id,
        title: newTimetableItem.title,
        moduleId: newTimetableItem.moduleId,
        dayOfWeek: newTimetableItem.selectedDays[0],
        startTime: newTimetableItem.startTime,
        endTime: newTimetableItem.endTime,
        color: module?.color || COLORS[0],
        is_recurring: true,
      });
    } else {
      newTimetableItem.selectedDays.forEach((dayOfWeek, index) => {
        addScheduleItem({
          id: `${Date.now()}-${dayOfWeek}-${index}`,
          title: newTimetableItem.title,
          moduleId: newTimetableItem.moduleId,
          dayOfWeek,
          startTime: newTimetableItem.startTime,
          endTime: newTimetableItem.endTime,
          color: module?.color || COLORS[0],
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
      if (typeof window !== "undefined" && window.confirm(`Are you sure you want to delete "${title}"?`)) {
        deleteScheduleItem(id);
      }
    } else {
      Alert.alert("Delete Class", `Are you sure you want to delete "${title}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteScheduleItem(id),
        },
      ]);
    }
  };

  // Check if a time slot has a class
  const getClassForTimeSlot = (dayIndex: number, timeSlot: string) => {
    const daySchedule = getScheduleForDay(dayIndex);
    return daySchedule.find((s) => s.startTime === timeSlot);
  };

  const handleGenerateAssessment = async () => {
    if (!selectedModule) {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.alert("Please select a module first.");
      } else {
        Alert.alert("Error", "Please select a module");
      }
      return;
    }

    const module = modules.find((m) => m.id === selectedModule);
    if (!module) return;

    const finalCount = Math.min(Math.max(questionCount, 10), 20);

    setGeneratingAssessment(true);
    try {
      const questions = await generateModuleQuiz(selectedModule, module.name, {
        questionCount: finalCount,
        questionType: selectedQuestionType,
        difficulty: selectedDifficulty,
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
      setAssessmentModalVisible(false);

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.alert("Quiz generated successfully!");
      } else {
        Alert.alert("Success", "Quiz generated from your uploaded module content.");
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
            selectedDays: [0],
            startTime: "08:00",
            endTime: "10:00",
            color: COLORS[0],
          });
          setTimetableModalVisible(true);
        }}
      >
        <Ionicons name="add-circle-outline" size={24} color="#083b23ff" />
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
        <Ionicons name="sparkles" size={24} color="#1d3a1aff" />
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
                    <Ionicons name="sparkles" size={16} color="#134926ff" />
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

  if (Platform.OS === "web") {
    return (
      <WebLayout>
        <ScrollView style={styles.webScheduleScroll} contentContainerStyle={styles.webScheduleContent} showsVerticalScrollIndicator={false}>
          {/* TOP HEADER & ACTION BAR */}
          <View style={styles.webScheduleHeaderRow}>
            <View>
              <Text style={styles.webScheduleTitle}>Schedule & Timetable</Text>
              <Text style={styles.webScheduleSubtitle}>Organize your weekly study sessions and track AI assessments</Text>
            </View>

            <TouchableOpacity
              style={styles.webAddClassBtn}
              onPress={() => {
                setEditingItem(null);
                setNewTimetableItem({
                  title: "",
                  moduleId: "",
                  selectedDays: [0],
                  startTime: "08:00",
                  endTime: "10:00",
                  color: COLORS[0],
                });
                setTimetableModalVisible(true);
              }}
            >
              <Ionicons name="add-circle" size={18} color="white" />
              <Text style={styles.webAddClassText}>Add to Timetable</Text>
            </TouchableOpacity>
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
          </View>

          {/* TAB SWITCHER */}
          <View style={styles.webTabSwitcherRow}>
            <TouchableOpacity
              style={[styles.webTabBtn, activeTab === "timetable" && styles.webTabBtnActive]}
              onPress={() => setActiveTab("timetable")}
            >
              <Ionicons name="calendar" size={17} color={activeTab === "timetable" ? "#6366f1" : "#64748b"} />
              <Text style={[styles.webTabBtnText, activeTab === "timetable" && styles.webTabBtnTextActive]}>Weekly Timetable Grid</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.webTabBtn, activeTab === "assessments" && styles.webTabBtnActive]}
              onPress={() => setActiveTab("assessments")}
            >
              <Ionicons name="clipboard" size={17} color={activeTab === "assessments" ? "#6366f1" : "#64748b"} />
              <Text style={[styles.webTabBtnText, activeTab === "assessments" && styles.webTabBtnTextActive]}>Assessments & Quizzes</Text>
            </TouchableOpacity>
          </View>

          {/* WEEKLY MATRIX GRID */}
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
                              setEditingItem(null);
                              setNewTimetableItem({
                                title: "",
                                moduleId: "",
                                selectedDays: [dayIndex],
                                startTime: hour,
                                endTime: `${String(parseInt(hour.split(":")[0]) + 1).padStart(2, "0")}:00`,
                                color: COLORS[0],
                              });
                              setTimetableModalVisible(true);
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
            <View style={styles.webAssessmentsGrid}>
              {assessments.length === 0 ? (
                <View style={styles.webEmptyStateCard}>
                  <Ionicons name="clipboard-outline" size={48} color="#94a3b8" />
                  <Text style={styles.webEmptyStateTitle}>No Assessments Yet</Text>
                  <Text style={styles.webEmptyStateSub}>Quizzes generated from your study modules will appear here.</Text>
                </View>
              ) : (
                assessments.map((a) => (
                  <View key={a.id} style={styles.webAssessmentCard}>
                    <View style={styles.webAssessmentHeader}>
                      <Text style={styles.webAssessmentTitle}>{a.title}</Text>
                      <View style={[styles.webScoreBadge, { backgroundColor: a.completed ? "#dcfce7" : "#fef3c7" }]}>
                        <Text style={[styles.webScoreText, { color: a.completed ? "#166534" : "#92400e" }]}>
                          {a.completed ? `${a.score || 0}%` : "Pending"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.webAssessmentMeta}>{a.questionCount || a.questions?.length || 10} Questions • {getModuleName(a.moduleId)}</Text>
                    <TouchableOpacity
                      style={styles.webStartQuizBtn}
                      onPress={() => navigation.navigate("Quiz", { id: a.id })}
                    >
                      <Text style={styles.webStartQuizText}>{a.completed ? "Review Assessment" : "Start Quiz"}</Text>
                      <Ionicons name="arrow-forward" size={14} color="white" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Timetable Modal */}
          <Modal
            visible={timetableModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setTimetableModalVisible(false)}
          >
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setTimetableModalVisible(false)}>
              <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{editingItem ? "Edit Class" : "Add to Timetable"}</Text>
                  <TouchableOpacity onPress={() => setTimetableModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  <Text style={styles.modalLabel}>Class / Subject Name *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. Data Structures Lecture"
                    value={editingItem ? editingItem.title : newTimetableItem.title}
                    onChangeText={(text) =>
                      editingItem ? setEditingItem({ ...editingItem, title: text }) : setNewTimetableItem({ ...newTimetableItem, title: text })
                    }
                  />

                  <Text style={styles.modalLabel}>Module *</Text>
                  <View style={styles.moduleList}>
                    {modules.map((m) => {
                      const isSelected = (editingItem ? editingItem.moduleId : newTimetableItem.moduleId) === m.id;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[styles.moduleOption, isSelected && styles.moduleOptionSelected]}
                          onPress={() => (editingItem ? setEditingItem({ ...editingItem, moduleId: m.id }) : setNewTimetableItem({ ...newTimetableItem, moduleId: m.id }))}
                        >
                          <View style={[styles.moduleColorDot, { backgroundColor: m.color || "#6366f1" }]} />
                          <Text style={styles.moduleOptionText}>{m.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity style={styles.saveButton} onPress={handleAddSchedule}>
                    <Text style={styles.saveButtonText}>{editingItem ? "Update Class" : "Save Class"}</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
        </ScrollView>
      </WebLayout>
    );
  }

  return (
    <WebLayout>
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
            color={activeTab === "timetable" ? "#185516ff" : "#6b7280"}
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
            color={activeTab === "assessments" ? "#45cf53ff" : "#6b7280"}
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

              <Text style={styles.modalLabel}>Study Days</Text>
              <Text style={styles.dayHelperText}>Select every day you want to study this module.</Text>
              <View style={styles.dayList}>
                {DAYS.map((day, index) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayOption,
                      newTimetableItem.selectedDays.includes(index) &&
                      styles.dayOptionSelected,
                    ]}
                    onPress={() => {
                      const selectedDays = newTimetableItem.selectedDays.includes(index)
                        ? newTimetableItem.selectedDays.filter((dayIndex) => dayIndex !== index)
                        : [...newTimetableItem.selectedDays, index].sort((first, second) => first - second);
                      setNewTimetableItem({ ...newTimetableItem, selectedDays });
                    }}
                  >
                    <Text
                      style={[
                        styles.dayOptionText,
                        newTimetableItem.selectedDays.includes(index) &&
                        styles.dayOptionTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                    {newTimetableItem.selectedDays.includes(index) && (
                      <Ionicons name="checkmark-circle" size={16} color="#166534" />
                    )}
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
                  (!newTimetableItem.moduleId || newTimetableItem.selectedDays.length === 0) && styles.saveButtonDisabled,
                ]}
                onPress={handleAddSchedule}
                disabled={!newTimetableItem.moduleId || newTimetableItem.selectedDays.length === 0}
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

            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalLabel}>Select Module *</Text>
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
                        { backgroundColor: module.color || "#6366f1" },
                      ]}
                    />
                    <Text style={styles.moduleOptionText}>{module.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Question Types *</Text>
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

              <Text style={styles.modalLabel}>Level of Difficulty *</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                {[
                  { id: "low", label: "Low (Easy)" },
                  { id: "medium", label: "Medium" },
                  { id: "high", label: "High (Challenging)" },
                ].map((diff) => (
                  <TouchableOpacity
                    key={diff.id}
                    style={[
                      styles.typeOption,
                      { flex: 1, marginBottom: 0, alignItems: "center" },
                      selectedDifficulty === diff.id && styles.typeOptionSelected,
                    ]}
                    onPress={() => setSelectedDifficulty(diff.id as any)}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        selectedDifficulty === diff.id && styles.typeOptionTextSelected,
                      ]}
                    >
                      {diff.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Number of Questions (10 - 20) *</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <TouchableOpacity
                  style={[styles.webSlideNavBtn, { width: 36, height: 36, alignItems: "center", justifyContent: "center" }]}
                  onPress={() => setQuestionCount(Math.max(10, questionCount - 1))}
                >
                  <Ionicons name="remove" size={18} color="#0f172a" />
                </TouchableOpacity>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#0f172a", minWidth: 40, textAlign: "center" }}>
                  {questionCount}
                </Text>
                <TouchableOpacity
                  style={[styles.webSlideNavBtn, { width: 36, height: 36, alignItems: "center", justifyContent: "center" }]}
                  onPress={() => setQuestionCount(Math.min(20, questionCount + 1))}
                >
                  <Ionicons name="add" size={18} color="#0f172a" />
                </TouchableOpacity>
                <Text style={{ fontSize: 12, color: "#64748b" }}>(Min: 10, Max: 20)</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!selectedModule || generatingAssessment) && styles.saveButtonDisabled,
                ]}
                onPress={handleGenerateAssessment}
                disabled={!selectedModule || generatingAssessment}
              >
                <Text style={styles.saveButtonText}>
                  {generatingAssessment ? "Generating Quiz with AI..." : "Generate Quiz"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <BottomNav />
    </SafeAreaView>
  </WebLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
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
    color: "#55d164ff",
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
    fontSize: 28,
    fontWeight: "700",
    color: "#369c11ff",
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
    backgroundColor: "#3cd961ff",
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
    borderColor: "#15af36ff",
    borderStyle: "dashed",
  },
  addTimetableText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#33c963ff",
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
    backgroundColor: "#28d23cff",
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
    borderColor: "#1a5e30ff",
    borderStyle: "dashed",
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a5e30ff",
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
    backgroundColor: "#164f36ff",
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
    borderColor: "#61dc54ff",
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
  webSlideNavBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: "#e2e8f0",
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
  dayHelperText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: -8,
    marginBottom: 10,
  },
  dayOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
  },
  dayOptionSelected: {
    borderColor: "#42ba68ff",
    backgroundColor: "#eef2ff",
  },
  dayOptionText: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  dayOptionTextSelected: {
    color: "#3db01dff",
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
    borderColor: "#63f178ff",
    backgroundColor: "#eef2ff",
  },
  typeOptionText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
  },
  typeOptionTextSelected: {
    color: "#2fbb2aff",
  },
  saveButton: {
    backgroundColor: "#63f18cff",
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

  // Web Schedule Matrix Styles
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
  webAddClassBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#6366f1",
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
    alignItems: "center",
  },
  webAssessmentTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
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
});
