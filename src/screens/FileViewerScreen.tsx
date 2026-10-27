// src/screens/FileViewerScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_URL } from "../config/api";
import { useStore } from "../context/StoreContext";
import DocumentPdf from "../components/DocumentPdf";
import { createChatSession, sendChatMessage } from "../lib/aiChatApi";
import { uploadFileToDatabase } from "../lib/fileApi";
import type { RootStackParamList } from "../navigation/types";

type ContentResponse = {
  success: boolean;
  id: number;
  name: string;
  type: string;
  size: number;
  kind: "text" | "image" | "pdf" | "unsupported";
  text: string | null;
  rawUrl: string;
  error?: string;
};

interface SlideData {
  slideNumber: number;
  title: string;
  lines: string[];
}

export function FileViewerScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "FileViewer">>();
  const { id } = route.params;

  const {
    files,
    modules,
    profile,
    schedule,
    assessments,
    attendance,
    user,
    setFileRemoteId,
  } = useStore();
  const file = files.find((f) => f.id === id);
  const module = modules.find((item) => item.id === file?.moduleId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<ContentResponse | null>(null);
  const [remoteId, setRemoteId] = useState<string | null>(null);

  // Web Layout & View States (ZeusLearn Style)
  const [activeTab, setActiveTab] = useState<"files" | "flashcards" | "quizzes" | "summary" | "notes">("files");
  const [zoomLevel, setZoomLevel] = useState(100);

  // Presentation Slide States
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [presentationMode, setPresentationMode] = useState<"slides" | "text">("slides");

  // AI Chat States
  const [chatVisible, setChatVisible] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | number | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { id: string; sender: "user" | "assistant"; message: string }[]
  >([]);
  const [chatSending, setChatSending] = useState(false);
  const [floatingTop, setFloatingTop] = useState(190);
  const [dragStart, setDragStart] = useState({ top: 190, y: 0 });
  const [dragMoved, setDragMoved] = useState(false);
  const { height: screenHeight } = useWindowDimensions();

  // Helper to ensure text never displays as [object Object]
  const getDisplayText = (val: any): string => {
    if (typeof val === "string") return val;
    if (!val) return "";
    if (typeof val === "object") {
      if (typeof val.text === "string") return val.text;
      if (Array.isArray(val)) {
        return val
          .map((item) => (typeof item === "string" ? item : item?.text || ""))
          .filter(Boolean)
          .join("\n\n");
      }
      if (Array.isArray(val.slides)) {
        return val.slides
          .map(
            (s: any, i: number) =>
              `--- Slide ${i + 1} ---\n${typeof s === "string" ? s : s?.text || ""}`,
          )
          .join("\n\n");
      }
      try {
        return JSON.stringify(val, null, 2);
      } catch {
        return "";
      }
    }
    return String(val);
  };

  const parseSlidesFromText = (rawText: string): SlideData[] => {
    if (!rawText) return [];

    const slideParts = rawText
      .split(/(?:^|\n)(?:---|\*\*\*|===)?\s*(?:Slide|Page)\s*\d+[:\s-]*/i)
      .filter((p) => p.trim().length > 0);

    if (slideParts.length > 1) {
      return slideParts.map((part, index) => {
        const lines = part.split("\n").map((l) => l.trim()).filter(Boolean);
        return {
          slideNumber: index + 1,
          title: lines[0] || `Slide ${index + 1}`,
          lines: lines.slice(1).length > 0 ? lines.slice(1) : lines,
        };
      });
    }

    const paragraphs = rawText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    if (paragraphs.length > 1) {
      return paragraphs.map((p, index) => {
        const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
        return {
          slideNumber: index + 1,
          title: lines[0] || `Slide ${index + 1}`,
          lines: lines.slice(1).length > 0 ? lines.slice(1) : lines,
        };
      });
    }

    const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
    return [
      {
        slideNumber: 1,
        title: lines[0] || "Presentation Slide 1",
        lines: lines.slice(1).length > 0 ? lines.slice(1) : lines,
      },
    ];
  };

  // ---------------------------------------------------------
  // Fetch viewer-ready content from the server
  // ---------------------------------------------------------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await AsyncStorage.getItem("authToken");
        if (!token) {
          throw new Error("You are not signed in.");
        }

        let remoteFileId = file?.remoteId;
        if (!remoteFileId && file?.uri && file.name) {
          const moduleName = modules.find(
            (item) => item.id === file.moduleId,
          )?.name;
          const uploadedFile = await uploadFileToDatabase({
            moduleId: file.moduleId,
            moduleName,
            uri: file.uri,
            name: file.name,
            type: file.type,
            size: file.size,
          });
          remoteFileId = uploadedFile.remoteId;
          await setFileRemoteId(file.id, remoteFileId);
        }
        if (!remoteFileId) throw new Error("This file has no server reference.");
        if (mounted) setRemoteId(remoteFileId);

        const response = await fetch(
          `${API_URL}/files/${encodeURIComponent(remoteFileId)}/content`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const data = (await response.json()) as ContentResponse;

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        if (mounted) setContent(data);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load file.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    file?.id,
    file?.remoteId,
    file?.uri,
    file?.name,
    file?.moduleId,
    file?.type,
    file?.size,
    modules,
    setFileRemoteId,
  ]);

  const handleSendChatMessage = async () => {
    const message = chatInput.trim();
    if (!message || chatSending) return;
    setChatInput("");
    setChatSending(true);
    setChatMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, sender: "user", message },
    ]);
    try {
      let sessionId = chatSessionId;
      if (!sessionId) {
        sessionId = await createChatSession({
          title: `Study: ${file?.name || "document"}`,
          moduleName: module?.name,
        });
        setChatSessionId(sessionId);
      }
      const answer = await sendChatMessage(sessionId, message, {
        user: user
          ? { onboardingCompleted: user.onboardingCompleted }
          : null,
        profile,
        modules: modules.slice(-100),
        files: files.slice(-50).map(({ name, type, moduleId }) => ({ name, type, moduleId })),
        schedule: schedule.slice(-42),
        assessments: assessments.slice(-30),
        attendance: attendance.slice(-30),
        activeStudySession: {
          fileName: file?.name,
          moduleName: module?.name,
          extractedText: getDisplayText(content?.text).slice(0, 10000),
        },
      });
      setChatMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, sender: "assistant", message: answer },
      ]);
    } catch (chatError) {
      const messageText =
        chatError instanceof Error ? chatError.message : "The AI could not respond.";
      setChatMessages((current) => [
        ...current,
        { id: `error-${Date.now()}`, sender: "assistant", message: messageText },
      ]);
    } finally {
      setChatSending(false);
    }
  };

  const handleQuickPrompt = (promptText: string) => {
    setChatInput(promptText);
  };

  // ---------------------------------------------------------
  // Open with an external app / Web download
  // ---------------------------------------------------------
  const openExternally = async () => {
    if (!file) return;
    try {
      if (Platform.OS === "web") {
        if (remoteId) {
          const token = await AsyncStorage.getItem("authToken");
          const res = await fetch(
            `${API_URL}/files/${encodeURIComponent(remoteId)}/raw`,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} }
          );
          if (res.ok) {
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = file.name || "download";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
            return;
          }
        }
        if (file.uri) {
          window.open(file.uri, "_blank");
          return;
        }
      }

      if (!file.uri) {
        Alert.alert(
          "Cannot open file",
          "This file has no available local location."
        );
        return;
      }

      if (Platform.OS === "android" && file.uri.startsWith("file://")) {
        const contentUri = await FileSystem.getContentUriAsync(file.uri);
        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          flags: 1,
          type: file.type || "*/*",
        });
        return;
      }

      if (Platform.OS === "ios" && file.uri.startsWith("file://")) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: file.type || "*/*",
          });
          return;
        }
      }

      Alert.alert(
        "Cannot open file",
        "No compatible app is installed for this file type."
      );
    } catch (e: any) {
      console.error("Open externally failed:", e);
      Alert.alert(
        "Cannot open file",
        e?.message || "An error occurred opening this file."
      );
    }
  };

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------
  if (!file) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="File not found" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.emptyText}>
            This file is no longer in your library.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // =========================================================
  // ZEUSLEARN WEB SPLIT-WORKSPACE LAYOUT (Platform.OS === 'web')
  // =========================================================
  if (Platform.OS === "web") {
    const textData = getDisplayText(content?.text);
    const fileNameLower = file.name.toLowerCase();
    const isPresentation =
      fileNameLower.endsWith(".pptx") ||
      fileNameLower.endsWith(".ppt") ||
      fileNameLower.endsWith(".key") ||
      textData.includes("--- Slide");

    const slides = isPresentation ? parseSlidesFromText(textData) : [];
    const activeSlide = slides[currentSlideIndex] || slides[0];

    return (
      <SafeAreaView style={styles.webRoot}>
        {/* Top Header Bar */}
        <View style={styles.webHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.webBackButton}>
            <Ionicons name="arrow-back" size={20} color="#111827" />
            <Text style={styles.webHeaderTitle}>{file.name}</Text>
          </TouchableOpacity>
        </View>

        {/* ZeusLearn-Style Split Workspace */}
        <View style={styles.webWorkspace}>
          {/* LEFT PANEL: Document & Tool Workspace (65% Width) */}
          <View style={styles.webMainPanel}>
            {/* ZeusLearn Top Tabs */}
            <View style={styles.webTabBar}>
              {[
                { id: "files", label: "Files", icon: "document-text-outline" },
                { id: "flashcards", label: "Flashcards", icon: "albums-outline" },
                { id: "quizzes", label: "Quizzes", icon: "help-circle-outline" },
                { id: "summary", label: "Summary", icon: "journal-outline" },
                { id: "notes", label: "Notes", icon: "create-outline" },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.webTabItem, activeTab === tab.id && styles.webTabItemActive]}
                  onPress={() => {
                    setActiveTab(tab.id as any);
                    if (tab.id !== "files") {
                      handleQuickPrompt(`Generate ${tab.label} for this document: ${file.name}`);
                    }
                  }}
                >
                  <Ionicons name={tab.icon as any} size={17} color={activeTab === tab.id ? "#6366f1" : "#6b7280"} />
                  <Text style={[styles.webTabText, activeTab === tab.id && styles.webTabTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ZeusLearn Document Controls Toolbar */}
            <View style={styles.webDocToolbar}>
              <View style={styles.webZoomControls}>
                {isPresentation && slides.length > 1 ? (
                  <View style={styles.webSlideNavControls}>
                    <TouchableOpacity
                      style={[styles.webSlideNavBtn, currentSlideIndex === 0 && { opacity: 0.4 }]}
                      onPress={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                      disabled={currentSlideIndex === 0}
                    >
                      <Ionicons name="chevron-back" size={16} color="#1e293b" />
                    </TouchableOpacity>
                    <Text style={styles.webSlideNavText}>Slide {currentSlideIndex + 1} / {slides.length}</Text>
                    <TouchableOpacity
                      style={[styles.webSlideNavBtn, currentSlideIndex === slides.length - 1 && { opacity: 0.4 }]}
                      onPress={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))}
                      disabled={currentSlideIndex === slides.length - 1}
                    >
                      <Ionicons name="chevron-forward" size={16} color="#1e293b" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity onPress={() => setZoomLevel(Math.max(50, zoomLevel - 15))} style={styles.webToolIconBtn}>
                      <Ionicons name="remove-circle-outline" size={18} color="#4b5563" />
                    </TouchableOpacity>
                    <Text style={styles.webZoomText}>{zoomLevel}%</Text>
                    <TouchableOpacity onPress={() => setZoomLevel(Math.min(200, zoomLevel + 15))} style={styles.webToolIconBtn}>
                      <Ionicons name="add-circle-outline" size={18} color="#4b5563" />
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {isPresentation && (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.webToggleBtn, presentationMode === "slides" && styles.webToggleBtnActive]}
                    onPress={() => setPresentationMode("slides")}
                  >
                    <Ionicons name="easel-outline" size={15} color={presentationMode === "slides" ? "#6366f1" : "#64748b"} />
                    <Text style={[styles.webToggleBtnText, presentationMode === "slides" && styles.webToggleBtnTextActive]}>Slides Deck</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.webToggleBtn, presentationMode === "text" && styles.webToggleBtnActive]}
                    onPress={() => setPresentationMode("text")}
                  >
                    <Ionicons name="text-outline" size={15} color={presentationMode === "text" ? "#6366f1" : "#64748b"} />
                    <Text style={[styles.webToggleBtnText, presentationMode === "text" && styles.webToggleBtnTextActive]}>Full Text</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={styles.webDownloadBtn} onPress={openExternally}>
                <Ionicons name="download-outline" size={16} color="#6366f1" />
                <Text style={styles.webDownloadText}>Download Original</Text>
              </TouchableOpacity>
            </View>

            {/* Document Canvas Display */}
            <View style={styles.webDocCanvas}>
              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color="#6366f1" />
                  <Text style={styles.dim}>Loading presentation / document…</Text>
                </View>
              ) : error ? (
                <View style={styles.center}>
                  <Ionicons name="cloud-offline-outline" size={48} color="#ef4444" />
                  <Text style={styles.emptyText}>{error}</Text>
                </View>
              ) : content?.kind === "pdf" && remoteId ? (
                <DocumentPdf fileId={remoteId} />
              ) : content?.kind === "image" && remoteId ? (
                <ScrollView contentContainerStyle={styles.imageScroll}>
                  <AuthedImage fileId={remoteId} />
                </ScrollView>
              ) : isPresentation && slides.length > 0 && presentationMode === "slides" ? (
                /* INTERACTIVE POWERPOINT SLIDE CANVAS (ZeusLearn Widescreen Slide Deck) */
                <View style={styles.webPresentationWrapper}>
                  {/* Active Widescreen Slide Card */}
                  <View style={styles.webSlideCard}>
                    <View style={styles.webSlideHeaderRow}>
                      <View style={styles.webSlideBadge}>
                        <Ionicons name="easel" size={14} color="#6366f1" />
                        <Text style={styles.webSlideBadgeText}>SLIDE {activeSlide.slideNumber} OF {slides.length}</Text>
                      </View>
                    </View>

                    <ScrollView style={styles.webSlideBodyScroll}>
                      <Text style={styles.webSlideTitleText}>{activeSlide.title}</Text>
                      <View style={styles.webSlideLinesList}>
                        {activeSlide.lines.map((line, lIdx) => (
                          <View key={lIdx} style={styles.webSlideLineRow}>
                            <View style={styles.webBulletDot} />
                            <Text style={styles.webSlideLineText}>{line}</Text>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  </View>

                  {/* Horizontal Slide Selector Bar */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.webSlideSelectorBar}>
                    {slides.map((s, idx) => (
                      <TouchableOpacity
                        key={s.slideNumber}
                        style={[styles.webSlidePill, idx === currentSlideIndex && styles.webSlidePillActive]}
                        onPress={() => setCurrentSlideIndex(idx)}
                      >
                        <Text style={[styles.webSlidePillText, idx === currentSlideIndex && styles.webSlidePillTextActive]}>
                          Slide {s.slideNumber}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : textData ? (
                <ScrollView contentContainerStyle={styles.webTextDocumentScroll}>
                  <Text style={[styles.textContent, { fontSize: Math.round(14 * (zoomLevel / 100)) }]} selectable>
                    {textData}
                  </Text>
                </ScrollView>
              ) : remoteId ? (
                <DocumentPdf fileId={remoteId} />
              ) : (
                <View style={styles.center}>
                  <Text style={styles.emptyText}>Document ready. Ask the AI Tutor or download the original file.</Text>
                </View>
              )}
            </View>
          </View>

          {/* RIGHT PANEL: AI Tutor Chat Sidebar (35% Width) */}
          <View style={styles.webChatPanel}>
            <View style={styles.webChatHeader}>
              <View style={styles.webChatHeaderTitleRow}>
                <Ionicons name="sparkles" size={18} color="#6366f1" />
                <Text style={styles.webChatTitle}>AI Tutor</Text>
              </View>
              <TouchableOpacity onPress={() => { setChatMessages([]); setChatSessionId(null); }} style={styles.webNewChatBtn}>
                <Ionicons name="add-outline" size={16} color="#6366f1" />
                <Text style={styles.webNewChatText}>New Chat</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Suggestion Chips (ZeusLearn Style) */}
            <View style={styles.webSuggestionRow}>
              {[
                { label: "Flashcards", prompt: `Create study flashcards from ${file.name}` },
                { label: "Summary", prompt: `Summarize the key concepts in ${file.name}` },
                { label: "Quiz", prompt: `Generate a 5-question quiz based on ${file.name}` },
                { label: "Mind Map", prompt: `Outline the core topics and mind map for ${file.name}` },
              ].map((chip) => (
                <TouchableOpacity key={chip.label} style={styles.webChipBtn} onPress={() => handleQuickPrompt(chip.prompt)}>
                  <Text style={styles.webChipText}>{chip.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Conversation Area */}
            <ScrollView style={styles.chatMessages} contentContainerStyle={styles.chatMessagesContent}>
              {chatMessages.length === 0 ? (
                <View style={styles.webChatWelcome}>
                  <Ionicons name="chatbubbles-outline" size={42} color="#818cf8" />
                  <Text style={styles.webChatWelcomeTitle}>Chat with the AI Tutor</Text>
                  <Text style={styles.webChatWelcomeSubtitle}>Ask anything about {file.name} or pick a quick suggestion above.</Text>
                </View>
              ) : (
                chatMessages.map((item) => (
                  <View key={item.id} style={[styles.chatBubble, item.sender === "user" ? styles.userBubble : styles.assistantBubble]}>
                    <Text style={item.sender === "user" ? styles.userBubbleText : styles.assistantBubbleText}>{item.message}</Text>
                  </View>
                ))
              )}
              {chatSending && <ActivityIndicator color="#6366f1" style={{ marginVertical: 8 }} />}
            </ScrollView>

            {/* Chat Composer Bar */}
            <View style={styles.webChatComposer}>
              <TextInput
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Ask tutor anything about this document…"
                style={styles.webChatInput}
                multiline
                maxLength={2000}
                returnKeyType="send"
                onSubmitEditing={handleSendChatMessage}
              />
              <TouchableOpacity style={styles.webSendBtn} onPress={handleSendChatMessage} disabled={!chatInput.trim() || chatSending}>
                <Ionicons name="arrow-up" size={18} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // =========================================================
  // NATIVE MOBILE LAYOUT
  // =========================================================
  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#35ce61" />
          <Text style={styles.dim}>Loading file…</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={20} color="white" />
            <Text style={styles.primaryButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!content) return null;

    // ---- Images ----
    if (content.kind === "image" && remoteId) {
      return (
        <ScrollView
          contentContainerStyle={styles.imageScroll}
          maximumZoomScale={4}
          minimumZoomScale={1}
        >
          <AuthedImage fileId={remoteId} />
        </ScrollView>
      );
    }

    // ---- PDF ----
    if (content.kind === "pdf" && remoteId) {
      return <DocumentPdf fileId={remoteId} />;
    }

    // ---- Extracted text ----
    if (content.kind === "text" && content.text) {
      const textStr = getDisplayText(content.text);
      return (
        <ScrollView contentContainerStyle={styles.textScroll}>
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={18} color="#1e40af" />
            <Text style={styles.noticeText}>
              Text preview. Original formatting is preserved in the external viewer.
            </Text>
          </View>
          <Text style={styles.textContent} selectable>
            {textStr}
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { marginTop: 20 }]}
            onPress={openExternally}
          >
            <Ionicons name="open-outline" size={20} color="white" />
            <Text style={styles.primaryButtonText}>Open original file</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    // ---- Fallback ----
    return (
      <View style={styles.center}>
        <Ionicons name="document-outline" size={64} color="#6b7280" />
        <Text style={styles.emptyText}>
          This file type can&apos;t be previewed here yet.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={openExternally}>
          <Ionicons name="open-outline" size={20} color="white" />
          <Text style={styles.primaryButtonText}>Open with…</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header title={file.name} onBack={() => navigation.goBack()} />
      {renderBody()}
      <View
        style={[styles.floatingChat, { top: floatingTop }]}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Open study assistant. Drag up or down to move."
        onTouchStart={(event) => {
          setDragStart({ top: floatingTop, y: event.nativeEvent.pageY });
          setDragMoved(false);
        }}
        onTouchMove={(event) => {
          const delta = event.nativeEvent.pageY - dragStart.y;
          if (Math.abs(delta) > 4) setDragMoved(true);
          setFloatingTop(
            Math.max(80, Math.min(screenHeight - 130, dragStart.top + delta)),
          );
        }}
        onTouchEnd={() => {
          if (!dragMoved) setChatVisible(true);
        }}
      >
        <Ionicons name="chatbubble-ellipses" size={23} color="white" />
      </View>
      <Modal
        visible={chatVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setChatVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.chatModalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.chatPanel}>
            <View style={styles.chatHeader}>
              <View>
                <Text style={styles.chatTitle}>Study assistant</Text>
                <Text style={styles.chatSubtitle} numberOfLines={1}>
                  {module?.name || "Your study materials"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setChatVisible(false)} accessibilityLabel="Close study assistant">
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.chatMessages} contentContainerStyle={styles.chatMessagesContent}>
              {chatMessages.length === 0 ? (
                <Text style={styles.chatEmpty}>
                  Ask a question about {file.name}. I can use this document and your study context.
                </Text>
              ) : chatMessages.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.chatBubble,
                    item.sender === "user" ? styles.userBubble : styles.assistantBubble,
                  ]}
                >
                  <Text style={item.sender === "user" ? styles.userBubbleText : styles.assistantBubbleText}>
                    {item.message}
                  </Text>
                </View>
              ))}
              {chatSending && <ActivityIndicator color="#35ce61" />}
            </ScrollView>
            <View style={styles.chatComposer}>
              <TextInput
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Ask about this material…"
                style={styles.chatInput}
                multiline
                maxLength={2000}
                returnKeyType="send"
                onSubmitEditing={handleSendChatMessage}
              />
              <TouchableOpacity
                style={styles.chatSendButton}
                onPress={handleSendChatMessage}
                disabled={!chatInput.trim() || chatSending}
                accessibilityLabel="Send message"
              >
                <Ionicons name="send" size={19} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------
// AuthedImage — fetches the raw endpoint with a Bearer token
// ---------------------------------------------------------
function AuthedImage({ fileId }: { fileId: string }) {
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await AsyncStorage.getItem("authToken");
        const res = await fetch(
          `${API_URL}/files/${encodeURIComponent(fileId)}/raw`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();

        const reader = new FileReader();
        reader.onloadend = () => {
          if (mounted) setDataUri(reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch {
        if (mounted) setFailed(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fileId]);

  if (failed) {
    return <Text style={styles.emptyText}>Could not load image.</Text>;
  }
  if (!dataUri) {
    return <ActivityIndicator size="large" color="#35ce61" />;
  }
  return (
    <Image
      source={{ uri: dataUri }}
      style={styles.image}
      resizeMode="contain"
    />
  );
}

// ---------------------------------------------------------
// Header
// ---------------------------------------------------------
function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#111827" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------
// Styles
// ---------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", alignItems: Platform.OS === 'web' ? 'center' : 'stretch' },
  header: {
    width: "100%",
    maxWidth: Platform.OS === "web" ? 1000 : "100%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  dim: { color: "#6b7280", fontSize: 13, marginTop: 8 },
  emptyText: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
  },
  imageScroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: { width: "100%", height: 500 },
  textScroll: { padding: 20, paddingBottom: 60 },
  textContent: {
    fontSize: 14,
    lineHeight: 22,
    color: "#111827",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    marginBottom: 16,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#1e40af",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#35ce61",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  primaryButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 15,
  },
  floatingChat: {
    position: "absolute",
    right: 0,
    width: 54,
    height: 54,
    borderTopLeftRadius: 27,
    borderBottomLeftRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#35ce61",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 10,
  },
  chatModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(17, 24, 39, 0.42)",
  },
  chatPanel: {
    height: "72%",
    backgroundColor: "white",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  chatTitle: { color: "#111827", fontSize: 17, fontWeight: "700" },
  chatSubtitle: { color: "#6b7280", fontSize: 12, marginTop: 3, maxWidth: 250 },
  chatMessages: { flex: 1 },
  chatMessagesContent: { padding: 16, gap: 10 },
  chatEmpty: {
    color: "#6b7280",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 28,
  },
  chatBubble: {
    maxWidth: "88%",
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#6366f1" },
  assistantBubble: { alignSelf: "flex-start", backgroundColor: "#f3f4f6" },
  userBubbleText: { color: "white", fontSize: 14, lineHeight: 20 },
  assistantBubbleText: { color: "#111827", fontSize: 14, lineHeight: 20 },
  chatComposer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  chatInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "#f9fafb",
  },
  chatSendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#35ce61",
    alignItems: "center",
    justifyContent: "center",
  },

  // ---------------------------------------------------------
  // ZEUSLEARN WEB STYLES
  // ---------------------------------------------------------
  webRoot: {
    flex: 1,
    backgroundColor: "#f8fafc",
    height: "100vh" as any,
  },
  webHeader: {
    height: 56,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  webBackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    cursor: "pointer" as any,
  },
  webHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  webWorkspace: {
    flex: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  webMainPanel: {
    flex: 0.65,
    backgroundColor: "#f8fafc",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
    display: "flex",
    flexDirection: "column",
  },
  webTabBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  webTabItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    cursor: "pointer" as any,
  },
  webTabItemActive: {
    backgroundColor: "#eef2ff",
    borderBottomWidth: 2,
    borderBottomColor: "#6366f1",
  },
  webTabText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748b",
  },
  webTabTextActive: {
    color: "#6366f1",
    fontWeight: "700",
  },
  webDocToolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  webZoomControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  webSlideNavControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  webSlideNavBtn: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: "#e2e8f0",
    cursor: "pointer" as any,
  },
  webSlideNavText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e293b",
    minWidth: 80,
    textAlign: "center",
  },
  webToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    cursor: "pointer" as any,
  },
  webToggleBtnActive: {
    backgroundColor: "#eef2ff",
    borderColor: "#c7d2fe",
  },
  webToggleBtnText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  webToggleBtnTextActive: {
    color: "#6366f1",
    fontWeight: "700",
  },
  webToolIconBtn: {
    cursor: "pointer" as any,
    padding: 2,
  },
  webZoomText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    minWidth: 42,
    textAlign: "center",
  },
  webDownloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c7d2fe",
    backgroundColor: "#eef2ff",
    cursor: "pointer" as any,
  },
  webDownloadText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4f46e5",
  },
  webDocCanvas: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  webPresentationWrapper: {
    flex: 1,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    alignItems: "center",
  },
  webSlideCard: {
    width: "100%",
    maxWidth: 820,
    aspectRatio: 1.6,
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 28,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    display: "flex",
    flexDirection: "column",
  },
  webSlideHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  webSlideBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  webSlideBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6366f1",
    letterSpacing: 0.5,
  },
  webSlideBodyScroll: {
    flex: 1,
  },
  webSlideTitleText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 16,
    lineHeight: 28,
  },
  webSlideLinesList: {
    gap: 10,
  },
  webSlideLineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  webBulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#6366f1",
    marginTop: 8,
  },
  webSlideLineText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: "#334155",
    fontWeight: "500",
  },
  webSlideSelectorBar: {
    maxHeight: 40,
    width: "100%",
    maxWidth: 820,
  },
  webSlidePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    marginRight: 8,
    cursor: "pointer" as any,
  },
  webSlidePillActive: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  webSlidePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  webSlidePillTextActive: {
    color: "white",
  },
  webTextDocumentScroll: {
    padding: 32,
    backgroundColor: "white",
    margin: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    minHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  webChatPanel: {
    flex: 0.35,
    backgroundColor: "white",
    display: "flex",
    flexDirection: "column",
  },
  webChatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  webChatHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  webChatTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  webNewChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#eef2ff",
    cursor: "pointer" as any,
  },
  webNewChatText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6366f1",
  },
  webSuggestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    padding: 12,
    backgroundColor: "#fafafa",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  webChipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    cursor: "pointer" as any,
  },
  webChipText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "500",
  },
  webChatWelcome: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
    gap: 10,
  },
  webChatWelcomeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
  },
  webChatWelcomeSubtitle: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
  },
  webChatComposer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "white",
  },
  webChatInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13,
    backgroundColor: "#f8fafc",
    color: "#0f172a",
  },
  webSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer" as any,
  },
});
