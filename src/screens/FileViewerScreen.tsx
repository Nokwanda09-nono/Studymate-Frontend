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
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_URL } from "../config/api";
import { useStore } from "../context/StoreContext";
import type { RootStackParamList } from "../navigation/types";

const SERVER_ORIGIN = API_URL.replace(/\/api\/?$/, "");

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

export function FileViewerScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "FileViewer">>();
  const { id } = route.params;

  const { files } = useStore();
  const file = files.find((f) => f.id === id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<ContentResponse | null>(null);
  const [remoteId, setRemoteId] = useState<string | null>(null);

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

        const remoteFileId = (file as any)?.remoteId || file?.id;
        setRemoteId(remoteFileId ?? null);

        if (!remoteFileId) {
          throw new Error("This file has no server reference.");
        }

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
  }, [file?.id]);

  // ---------------------------------------------------------
  // Open with an external app (PDF, or "Open original")
  // ---------------------------------------------------------
  const openExternally = async () => {
    if (!file) return;
    try {
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

    // ---- Images: served by /api/files/:id/raw ----
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

    // ---- PDF: route to external open ----
    if (content.kind === "pdf") {
      return (
        <View style={styles.center}>
          <Ionicons name="document-text" size={64} color="#ef4444" />
          <Text style={styles.emptyText}>
            PDFs open in your device's PDF reader.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={openExternally}
          >
            <Ionicons name="open-outline" size={20} color="white" />
            <Text style={styles.primaryButtonText}>Open PDF</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ---- Extracted text (docx/pptx/xlsx/txt/csv/md/json/xml) ----
    if (content.kind === "text" && content.text) {
      return (
        <ScrollView contentContainerStyle={styles.textScroll}>
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={18} color="#1e40af" />
            <Text style={styles.noticeText}>
              Text preview. Original formatting is preserved in the external viewer.
            </Text>
          </View>
          <Text style={styles.textContent} selectable>
            {content.text}
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
          This file type can't be previewed here yet.
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

        // Convert blob to base64 data URI without extra deps
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
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
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
});