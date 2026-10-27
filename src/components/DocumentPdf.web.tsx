import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../config/api";

export default function DocumentPdf({ fileId }: { fileId: string }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let mounted = true;
    (async () => {
      try {
        const token = await AsyncStorage.getItem("authToken");
        if (!token) throw new Error("Please sign in again to view this PDF.");
        const response = await fetch(
          `${API_URL}/files/${encodeURIComponent(fileId)}/raw`,
          { headers: { Authorization: `Bearer ${token.trim().replace(/^(?:Bearer\s+)+/i, "")}` } },
        );
        if (!response.ok) throw new Error(`The PDF could not be loaded (HTTP ${response.status}).`);
        objectUrl = URL.createObjectURL(await response.blob());
        if (mounted) setPdfUrl(objectUrl);
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Could not load PDF.");
        }
      }
    })();
    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  if (error) {
    return <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>;
  }
  if (!pdfUrl) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#35ce61" /></View>;
  }
  return (
    <iframe
      src={pdfUrl}
      title="PDF document"
      style={{ width: "100%", height: "100%", border: "none" }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorText: { color: "#6b7280", textAlign: "center" },
});
