// src/screens/FileViewerScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
import React, { useEffect, useState } from "react";
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

import { useStore } from "../context/StoreContext";

export function FileViewerScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params as { id: string };

  const { files } = useStore();
  const file = files.find((f) => f.id === id);

  const [loading, setLoading] = useState(true);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [exists, setExists] = useState(true);

  const type = (file?.type || "").toLowerCase();
  const isImage = type.startsWith("image/");
  const isPdf = type.includes("pdf");
  const isText =
    type.startsWith("text/") ||
    type.includes("json") ||
    type.includes("xml") ||
    file?.name?.toLowerCase().endsWith(".txt");

  // ---------------------------------------------------------
  // Check the file still exists + load text content if needed
  // ---------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!file?.uri) {
        if (mounted) {
          setExists(false);
          setLoading(false);
        }
        return;
      }

      const info = await FileSystem.getInfoAsync(file.uri);

      if (!mounted) return;

      if (!info.exists) {
        setExists(false);
        setLoading(false);
        return;
      }

      if (isText) {
        try {
          const content = await FileSystem.readAsStringAsync(file.uri);
          if (mounted) setTextContent(content);
        } catch (e) {
          console.warn("Failed to read text file:", e);
        }
      }

      if (mounted) setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [file?.uri, isText]);

  // ---------------------------------------------------------
  // Open with external app (Office docs, or "open in…")
  // ---------------------------------------------------------
  const openExternally = async () => {
    if (!file?.uri) return;

    try {
      if (Platform.OS === "android") {
        // Android needs a content:// URI for IntentLauncher.
        const contentUri = await FileSystem.getContentUriAsync(file.uri);
        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: file.type || "*/*",
        });
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: file.type || "*/*",
          });
        } else {
          Alert.alert("Cannot open", "No app available to open this file.");
        }
      }
    } catch (e) {
      console.error("Open externally failed:", e);
      Alert.alert(
        "Cannot open file",
        "No installed app can open this file type."
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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header title={file.name} onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#35ce61" />
        </View>
      ) : !exists ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyText}>
            This file is missing from device storage.{"\n"}
            Try uploading it again.
          </Text>
        </View>
      ) : isImage ? (
        <ScrollView
          contentContainerStyle={styles.imageScroll}
          maximumZoomScale={4}
          minimumZoomScale={1}
        >
          <Image
            source={{ uri: file.uri }}
            style={styles.image}
            resizeMode="contain"
          />
        </ScrollView>
      ) : isPdf ? (
        <View style={styles.center}>
          <Ionicons name="document-text" size={64} color="#ef4444" />
          <Text style={styles.emptyText}>
            Tap below to open this PDF in your device viewer.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={openExternally}
          >
            <Ionicons name="open-outline" size={20} color="white" />
            <Text style={styles.primaryButtonText}>Open PDF</Text>
          </TouchableOpacity>
        </View>
      ) : isText ? (
        <ScrollView contentContainerStyle={styles.textScroll}>
          <Text style={styles.textContent} selectable>
            {textContent ?? "Could not read this file."}
          </Text>
        </ScrollView>
      ) : (
        // Word / PowerPoint / Excel / anything else
        <View style={styles.center}>
          <Ionicons name="document-outline" size={64} color="#6b7280" />
          <Text style={styles.emptyText}>
            {"This file type can't be previewed inside the app.\n"}
            Open it with another app on your device.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={openExternally}
          >
            <Ionicons name="open-outline" size={20} color="white" />
            <Text style={styles.primaryButtonText}>Open with…</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------
// Header
// ---------------------------------------------------------
function Header({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
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
  image: {
    width: "100%",
    height: 500,
  },
  textScroll: { padding: 20 },
  textContent: {
    fontSize: 14,
    lineHeight: 22,
    color: "#111827",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
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