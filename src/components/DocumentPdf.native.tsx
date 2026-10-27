import AsyncStorage from "@react-native-async-storage/async-storage";
import Pdf from "react-native-pdf";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { API_URL } from "../config/api";

export default function DocumentPdf({ fileId }: { fileId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem("authToken")
      .then((storedToken: string | null) => {
        if (!storedToken) throw new Error("Please sign in again to view this PDF.");
        if (mounted) setToken(storedToken.trim().replace(/^(?:Bearer\s+)+/i, ""));
      })
      .catch((loadError: unknown) => {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Could not load PDF.");
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!token) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#35ce61" />
      </View>
    );
  }

  return (
    <Pdf
      source={{
        uri: `${API_URL}/files/${encodeURIComponent(fileId)}/raw`,
        headers: { Authorization: `Bearer ${token}` },
        cache: true,
      }}
      style={styles.pdf}
      onError={(pdfError) => {
        console.error("In-app PDF rendering failed:", pdfError);
        setError("This PDF could not be displayed. Try uploading it again.");
      }}
      trustAllCerts={false}
    />
  );
}

const styles = StyleSheet.create({
  pdf: { flex: 1, width: "100%" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorText: { color: "#6b7280", textAlign: "center" },
});
