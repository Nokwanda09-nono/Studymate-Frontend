import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNav } from '../components/ButtomNav';
import { CustomButton } from '../components/CustomButton';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { WebLayout } from '../components/WebLayout';
import { useStore } from '../context/StoreContext';
import {
  ChatMessage,
  ChatSession,
  createChatSession,
  fetchChatMessages,
  fetchChatSessions,
  sendChatMessageWithAction,
  StudyTimetableAction,
} from '../lib/aiChatApi';
import { Module } from '../lib/store';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const toUiMessages = (messages: ChatMessage[]): Message[] =>
  messages.map((message) => ({
    id: String(message.id),
    role: message.sender === 'user' ? 'user' : 'assistant',
    content: message.message,
  }));

const greeting = (moduleName: string | null) =>
  moduleName
    ? `Ask me anything about ${moduleName}. I’ll use its uploaded study materials when available.`
    : "Hello! I'm your AI study assistant. How can I help you today?";

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

function validateTimetableAction(
  action: StudyTimetableAction,
  modules: Module[],
  schedule: ReturnType<typeof useStore>['schedule'],
  profile: ReturnType<typeof useStore>['profile'],
): string | null {
  const moduleIds = new Set(modules.map((module) => module.id));
  const dailyStudyGoal = Number(profile?.studyHoursPerDay);
  const weeklyStudyDays = Number(profile?.studyDaysPerWeek);
  const generatedDays = new Set<number>();
  const generatedItems: StudyTimetableAction['items'] = [];
  const minutesByDay = new Map<number, number>();

  for (const item of action.items) {
    if (
      !moduleIds.has(item.moduleId) ||
      !Number.isInteger(item.dayOfWeek) ||
      item.dayOfWeek < 0 ||
      item.dayOfWeek > 6 ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.startTime) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.endTime) ||
      item.startTime >= item.endTime
    ) {
      return 'The suggested timetable contains an invalid module or time.';
    }

    const start = timeToMinutes(item.startTime);
    const end = timeToMinutes(item.endTime);
    const conflictsWithExisting = schedule.some(
      (existing) =>
        existing.dayOfWeek === item.dayOfWeek &&
        start < timeToMinutes(existing.endTime) &&
        end > timeToMinutes(existing.startTime),
    );
    const conflictsWithSuggestion = generatedItems.some(
      (existing) =>
        existing.dayOfWeek === item.dayOfWeek &&
        start < timeToMinutes(existing.endTime) &&
        end > timeToMinutes(existing.startTime),
    );
    if (conflictsWithExisting || conflictsWithSuggestion) {
      return 'The suggested timetable overlaps another scheduled session.';
    }

    generatedDays.add(item.dayOfWeek);
    minutesByDay.set(
      item.dayOfWeek,
      (minutesByDay.get(item.dayOfWeek) || 0) + end - start,
    );
    generatedItems.push(item);
  }

  if (
    Number.isFinite(weeklyStudyDays) &&
    weeklyStudyDays > 0 &&
    generatedDays.size > weeklyStudyDays
  ) {
    return 'The suggested timetable exceeds your selected study days per week.';
  }
  if (
    Number.isFinite(dailyStudyGoal) &&
    dailyStudyGoal > 0 &&
    [...minutesByDay.values()].some((minutes) => minutes > dailyStudyGoal * 60)
  ) {
    return 'The suggested timetable exceeds your study-hours-per-day goal.';
  }
  return null;
}

export function AIChatScreen() {
  const {
    modules,
    profile,
    user,
    files,
    schedule,
    assessments,
    attendance,
    addScheduleItem,
  } = useStore();
  const { width: screenWidth } = useWindowDimensions();
  const drawerWidth = Math.min(360, screenWidth * 0.86);
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', content: greeting(null) },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sidebarError, setSidebarError] = useState('');
  const [activeModuleName, setActiveModuleName] = useState<string | null>(null);
  const [activeSessionTitle, setActiveSessionTitle] = useState('');
  const [openingSessionId, setOpeningSessionId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<Message>>(null);
  const sessionIdRef = useRef<string | number | null>(null);
  const isSendingRef = useRef(false);
  const drawerX = useRef(new Animated.Value(-360)).current;

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSidebarError('');
    try {
      setSessions(await fetchChatSessions());
    } catch (error) {
      setSidebarError(
        error instanceof Error ? error.message : 'Could not load chat history.',
      );
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (sidebarVisible) {
      drawerX.setValue(-drawerWidth);
      Animated.timing(drawerX, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [drawerWidth, drawerX, sidebarVisible]);

  const closeSidebar = () => {
    Animated.timing(drawerX, {
      toValue: -drawerWidth,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setSidebarVisible(false);
    });
  };

  const startNewChat = (moduleName: string | null = null) => {
    sessionIdRef.current = null;
    setActiveModuleName(moduleName);
    setActiveSessionTitle('');
    setMessages([
      { id: 'welcome', role: 'assistant', content: greeting(moduleName) },
    ]);
    setInput('');
    closeSidebar();
  };

  const openProjectChat = (module: Module) => {
    startNewChat(module.name);
  };

  const openSession = async (session: ChatSession) => {
    const sessionId = String(session.id);
    setOpeningSessionId(sessionId);
    setSidebarError('');
    try {
      const chatMessages = await fetchChatMessages(session.id);
      sessionIdRef.current = session.id;
      setActiveModuleName(session.module_name || null);
      setActiveSessionTitle(session.session_title);
      setMessages(toUiMessages(chatMessages));
      setInput('');
      closeSidebar();
    } catch (error) {
      setSidebarError(
        error instanceof Error ? error.message : 'Could not open this chat.',
      );
    } finally {
      setOpeningSessionId(null);
    }
  };

  const handleSend = async () => {
    const message = input.trim();
    if (!message || isSendingRef.current) return;
    isSendingRef.current = true;

    setMessages((previous) => [
      ...previous,
      { id: `${Date.now()}-user`, role: 'user', content: message },
    ]);
    setInput('');
    setIsTyping(true);

    try {
      const sessionId =
        sessionIdRef.current ??
        (await createChatSession({
          title: message.slice(0, 60),
          moduleName: activeModuleName,
        }));
      sessionIdRef.current = sessionId;
      if (!activeSessionTitle) setActiveSessionTitle(message.slice(0, 60));

      const response = await sendChatMessageWithAction(sessionId, message, {
        user: user
          ? { onboardingCompleted: user.onboardingCompleted }
          : null,
        profile,
        modules: modules.slice(-100),
        files: files.slice(-50).map(({ name, type, moduleId, uploadedAt }) => ({
          name,
          type,
          moduleId,
          uploadedAt,
        })),
        schedule: schedule.slice(-42),
        assessments: assessments.slice(-30),
        attendance: attendance.slice(-30),
        currentScreen: 'AIChat',
      });
      setMessages((previous) => [
        ...previous,
        { id: `${Date.now()}-assistant`, role: 'assistant', content: response.message },
      ]);
      if (response.action) {
        const validationError = validateTimetableAction(
          response.action,
          modules,
          schedule,
          profile,
        );
        if (validationError) {
          Alert.alert('Timetable not applied', validationError);
        } else {
          Alert.alert(
            'Apply suggested timetable?',
            `Add ${response.action.items.length} study session${response.action.items.length === 1 ? '' : 's'} to your schedule?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Add sessions',
                onPress: () => {
                  response.action?.items.forEach((item, index) => {
                    const module = modules.find(
                      (candidate) => candidate.id === item.moduleId,
                    );
                    addScheduleItem({
                      id: `ai-${Date.now()}-${index}`,
                      title: item.title,
                      moduleId: item.moduleId,
                      dayOfWeek: item.dayOfWeek,
                      startTime: item.startTime,
                      endTime: item.endTime,
                      color: module?.color || '#35ce61',
                      is_recurring: true,
                    });
                  });
                  setMessages((previous) => [
                    ...previous,
                    {
                      id: `${Date.now()}-applied`,
                      role: 'assistant',
                      content: 'Your study sessions have been added to your timetable.',
                    },
                  ]);
                },
              },
            ],
          );
        }
      }
      void refreshSessions();
    } catch (error) {
      console.error('AI chat error:', error);
      setMessages((previous) => [
        ...previous,
        {
          id: `${Date.now()}-error`,
          role: 'assistant',
          content:
            error instanceof Error
              ? error.message
              : 'The AI could not answer right now.',
        },
      ]);
    } finally {
      isSendingRef.current = false;
      setIsTyping(false);
    }
  };

  const toggleProject = (moduleId: string) => {
    setExpandedProjects((previous) => {
      const next = new Set(previous);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageRow,
        item.role === 'user' ? styles.userRow : styles.assistantRow,
      ]}
    >
      {item.role === 'assistant' && (
        <View style={styles.assistantAvatar}>
          <Ionicons name="chatbubble" size={20} color="white" />
        </View>
      )}
      <View
        style={[
          styles.messageBubble,
          item.role === 'user' ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            item.role === 'user' ? styles.userText : styles.assistantText,
          ]}
        >
          {item.content}
        </Text>
      </View>
      {item.role === 'user' && (
        <View style={styles.userAvatar}>
          <ProfileAvatar
            avatarId={profile?.selectedAvatar}
            size={32}
            iconColor="#6b7280"
          />
        </View>
      )}
    </View>
  );

  const renderSession = (session: ChatSession) => (
    <Pressable
      key={String(session.id)}
      accessibilityRole="button"
      style={styles.sessionButton}
      onPress={() => void openSession(session)}
      disabled={openingSessionId !== null}
    >
      {openingSessionId === String(session.id) ? (
        <ActivityIndicator size="small" color="#6366f1" />
      ) : (
        <Ionicons name="chatbubble-outline" size={16} color="#6b7280" />
      )}
      <Text style={styles.sessionTitle} numberOfLines={1}>
        {session.session_title || 'Study chat'}
      </Text>
    </Pressable>
  );

  const generalSessions = sessions.filter((session) => !session.module_name);

  return (
    <WebLayout>
      <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open chat history and modules"
            onPress={() => setSidebarVisible(true)}
            style={styles.headerButton}
          >
            <Ionicons name="menu" size={27} color="#111827" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {activeModuleName || 'AI Study Assistant'}
            </Text>
            {activeModuleName ? (
              <Text style={styles.headerSubtitle}>Module chat</Text>
            ) : activeSessionTitle ? (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {activeSessionTitle}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start a new chat"
            onPress={() => startNewChat(activeModuleName)}
            style={styles.headerButton}
          >
            <Ionicons name="create-outline" size={23} color="#4f46e5" />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
          />

          {isTyping && (
            <View style={styles.typingIndicator}>
              <ActivityIndicator size="small" color="#6366f1" />
              <Text style={styles.typingText}>AI is thinking...</Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={
                activeModuleName
                  ? `Ask about ${activeModuleName}...`
                  : 'Ask me anything about your studies...'
              }
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
              editable={!isTyping}
            />
            <CustomButton
              title="Send"
              onPress={handleSend}
              size="small"
              style={styles.sendButton}
              disabled={!input.trim() || isTyping}
            />
          </View>
        </KeyboardAvoidingView>
      </View>

      <BottomNav />

      <Modal
        visible={sidebarVisible}
        transparent
        animationType="fade"
        onRequestClose={closeSidebar}
      >
        <View style={styles.drawerOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close chat sidebar"
            style={styles.drawerBackdrop}
            onPress={closeSidebar}
          />
          <Animated.View
            style={[
              styles.drawer,
              {
                width: drawerWidth,
                transform: [{ translateX: drawerX }],
              },
            ]}
          >
            <SafeAreaView style={styles.drawerSafeArea} edges={['top', 'bottom']}>
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerTitle}>StudyMate AI</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close chat sidebar"
                  onPress={closeSidebar}
                  hitSlop={10}
                >
                  <Ionicons name="close" size={25} color="#374151" />
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="button"
                style={styles.newChatButton}
                onPress={() => startNewChat()}
              >
                <Ionicons name="add-circle-outline" size={20} color="#4f46e5" />
                <Text style={styles.newChatText}>New general chat</Text>
              </Pressable>

              {sidebarError ? (
                <Text style={styles.sidebarError}>{sidebarError}</Text>
              ) : null}

              <ScrollView
                style={styles.drawerScroll}
                contentContainerStyle={styles.drawerScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.sectionTitle}>MODULES</Text>
                {modules.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Create a module in the Modules tab to add a project folder.
                  </Text>
                ) : (
                  modules.map((module) => {
                    const moduleSessions = sessions.filter(
                      (session) =>
                        session.module_name?.toLocaleLowerCase() ===
                        module.name.toLocaleLowerCase(),
                    );
                    const expanded = expandedProjects.has(module.id);
                    return (
                      <View key={module.id} style={styles.projectGroup}>
                        <View style={styles.projectRow}>
                          <Pressable
                            accessibilityRole="button"
                            style={styles.projectMain}
                            onPress={() => openProjectChat(module)}
                          >
                            <Ionicons
                              name="folder-open-outline"
                              size={19}
                              color={module.color || '#6366f1'}
                            />
                            <Text style={styles.projectName} numberOfLines={1}>
                              {module.name}
                            </Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${expanded ? 'Hide' : 'Show'} ${module.name} chat history`}
                            style={styles.expandButton}
                            onPress={() => toggleProject(module.id)}
                          >
                            <Ionicons
                              name={expanded ? 'chevron-up' : 'chevron-down'}
                              size={18}
                              color="#6b7280"
                            />
                          </Pressable>
                        </View>
                        {expanded && (
                          <View style={styles.projectSessions}>
                            <Pressable
                              accessibilityRole="button"
                              style={styles.sessionButton}
                              onPress={() => openProjectChat(module)}
                            >
                              <Ionicons name="add" size={17} color="#4f46e5" />
                              <Text style={styles.newProjectChatText}>
                                Ask in this project
                              </Text>
                            </Pressable>
                            {moduleSessions.map(renderSession)}
                            {moduleSessions.length === 0 ? (
                              <Text style={styles.projectEmptyText}>
                                No chats in this project yet.
                              </Text>
                            ) : null}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}

                <Text style={[styles.sectionTitle, styles.historyHeading]}>
                  GENERAL CHAT HISTORY
                </Text>
                {sessionsLoading && sessions.length === 0 ? (
                  <ActivityIndicator
                    style={styles.historyLoader}
                    size="small"
                    color="#6366f1"
                  />
                ) : generalSessions.length ? (
                  generalSessions.map(renderSession)
                ) : (
                  <Text style={styles.emptyText}>Your general chats will appear here.</Text>
                )}
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  </WebLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 1000 : '100%',
    alignSelf: 'center',
  },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 8,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 1000 : '100%',
    alignSelf: 'center',
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    marginTop: 2,
    maxWidth: '90%',
    fontSize: 11,
    color: '#6b7280',
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    gap: 16,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 12,
  },
  userBubble: {
    backgroundColor: '#6366f1',
  },
  assistantBubble: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: 'white',
  },
  assistantText: {
    color: '#111827',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 12,
    color: '#6b7280',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#f9fafb',
    maxHeight: 100,
  },
  sendButton: {
    paddingHorizontal: 16,
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17, 24, 39, 0.42)',
  },
  drawer: {
    height: '100%',
    backgroundColor: 'white',
    elevation: 18,
    shadowColor: '#111827',
    shadowOffset: { width: 5, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  drawerSafeArea: {
    flex: 1,
  },
  drawerHeader: {
    minHeight: 58,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  drawerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 14,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 10,
    backgroundColor: '#eef2ff',
  },
  newChatText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4338ca',
  },
  sidebarError: {
    marginHorizontal: 16,
    marginTop: 10,
    color: '#b91c1c',
    fontSize: 12,
    lineHeight: 17,
  },
  drawerScroll: {
    flex: 1,
    marginTop: 20,
  },
  drawerScrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  sectionTitle: {
    marginHorizontal: 6,
    marginBottom: 8,
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  projectGroup: {
    marginBottom: 4,
  },
  projectRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
  },
  projectMain: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 8,
  },
  projectName: {
    flex: 1,
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
  },
  expandButton: {
    width: 38,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectSessions: {
    marginLeft: 18,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#e5e7eb',
  },
  sessionButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 8,
    borderRadius: 7,
  },
  sessionTitle: {
    flex: 1,
    color: '#4b5563',
    fontSize: 13,
  },
  newProjectChatText: {
    color: '#4f46e5',
    fontSize: 13,
    fontWeight: '500',
  },
  projectEmptyText: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    color: '#9ca3af',
    fontSize: 12,
  },
  historyHeading: {
    marginTop: 22,
  },
  emptyText: {
    paddingHorizontal: 6,
    paddingVertical: 8,
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 18,
  },
  historyLoader: {
    alignSelf: 'flex-start',
    margin: 10,
  },
});
