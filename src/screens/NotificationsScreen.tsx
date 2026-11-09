// src/screens/NotificationsScreen.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export function NotificationsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔔 Notifications</Text>
      <Text style={styles.message}>No notifications scheduled yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: "#555",
  },
});
