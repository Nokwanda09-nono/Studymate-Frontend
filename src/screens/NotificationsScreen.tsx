import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebLayout } from "../components/WebLayout";
import { useStore } from "../context/StoreContext";
import {
  getNotificationPermissionStatus,
  NotificationPermissionState,
  requestNotificationPermission,
  sendUserNotification,
} from "../lib/notificationService";

export function NotificationsScreen() {
  const { schedule, settings, setSettings, profile, setProfile } = useStore();
  const [permission, setPermission] =
    useState<NotificationPermissionState>("undetermined");
  const [requestingPermission, setRequestingPermission] = useState(false);
  const notificationsEnabled = settings.notificationsEnabled === true;

  useEffect(() => {
    let active = true;
    getNotificationPermissionStatus()
      .then((status) => {
        if (active) {
          setPermission(status);
        }
      })
      .catch((error) => {
        console.error("Could not check notification permissions:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleToggleNotifications = async () => {
    if (notificationsEnabled) {
      setSettings({ ...settings, notificationsEnabled: false });
      return;
    }

    setRequestingPermission(true);
    try {
      const granted = await requestNotificationPermission();
      const status = await getNotificationPermissionStatus();
      setPermission(status);
      if (!granted) {
        const message =
          Platform.OS === "web"
            ? "Allow notifications for StudyMate in your browser settings, then try again."
            : "Allow notifications for StudyMate in your device settings, then try again.";
        if (Platform.OS === "web") {
          if (typeof window !== "undefined") {
            window.alert(message);
          }
        } else {
          Alert.alert("Notifications are disabled", message);
        }
        return;
      }

      setSettings({ ...settings, notificationsEnabled: true });
      if (
        profile &&
        (profile.studyPoints ?? 0) <= 100 &&
        !profile.lowPointsNotificationSent
      ) {
        const notificationSent = await sendUserNotification(
          "Study points are low",
          `You have ${profile.studyPoints ?? 0} points. If your balance reaches 0, your account and data will be permanently deleted.`,
        );
        if (notificationSent) {
          setProfile({ ...profile, lowPointsNotificationSent: true });
        }
      }
    } catch (error) {
      console.error("Could not enable notifications:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Please try enabling notifications again.";
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          window.alert(message);
        }
      } else {
        Alert.alert("Could not enable notifications", message);
      }
    } finally {
      setRequestingPermission(false);
    }
  };

  return (
    <WebLayout>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Ionicons name="notifications" size={28} color="#185a22" />
            <Text style={styles.title}>Notifications</Text>
          </View>
          <Text style={styles.description}>
            Get a reminder one hour before each scheduled study session, and
            notifications when attendance or study points change.
          </Text>

          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={styles.statusCopy}>
                <Text style={styles.statusTitle}>
                  {notificationsEnabled ? "Notifications are on" : "Notifications are off"}
                </Text>
                <Text style={styles.statusMessage}>
                  {permission === "unsupported"
                    ? "This browser does not support notifications."
                    : permission === "denied"
                      ? "Notifications are blocked in your device or browser settings."
                      : `${schedule.length} study session${schedule.length === 1 ? "" : "s"} in your timetable`}
                </Text>
              </View>
              {requestingPermission ? (
                <ActivityIndicator color="#185a22" />
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    notificationsEnabled
                      ? "Turn off notifications"
                      : "Enable notifications"
                  }
                  style={[
                    styles.toggleButton,
                    notificationsEnabled && styles.toggleButtonEnabled,
                  ]}
                  onPress={handleToggleNotifications}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      notificationsEnabled && styles.toggleButtonTextEnabled,
                    ]}
                  >
                    {notificationsEnabled ? "Turn off" : "Enable"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.sectionTitle}>You’ll be notified about</Text>
          <View style={styles.eventRow}>
            <Ionicons name="time-outline" size={20} color="#185a22" />
            <Text style={styles.eventText}>Study sessions starting in one hour</Text>
          </View>
          <View style={styles.eventRow}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#185a22" />
            <Text style={styles.eventText}>Attendance marked present or absent</Text>
          </View>
          <View style={styles.eventRow}>
            <Ionicons name="trending-down-outline" size={20} color="#185a22" />
            <Text style={styles.eventText}>Points deducted for missed sessions</Text>
          </View>
          <View style={styles.eventRow}>
            <Ionicons name="warning-outline" size={20} color="#d97706" />
            <Text style={styles.eventText}>
              Low balance warning at 100 points and account deletion at 0
            </Text>
          </View>
          {Platform.OS === "web" && (
            <Text style={styles.webNote}>
              Browser reminders work while StudyMate is open. Keep this tab open
              to receive scheduled reminders.
            </Text>
          )}
        </View>
      </SafeAreaView>
    </WebLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  content: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  title: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "700",
  },
  description: {
    color: "#6b7280",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  statusCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 28,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  statusCopy: {
    flex: 1,
    gap: 5,
  },
  statusTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  statusMessage: {
    color: "#6b7280",
    fontSize: 13,
  },
  toggleButton: {
    backgroundColor: "#185a22",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toggleButtonEnabled: {
    backgroundColor: "#f3f4f6",
  },
  toggleButtonText: {
    color: "white",
    fontWeight: "700",
  },
  toggleButtonTextEnabled: {
    color: "#374151",
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 14,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  eventText: {
    color: "#374151",
    fontSize: 14,
    flex: 1,
  },
  webNote: {
    color: "#92400e",
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    fontSize: 13,
    lineHeight: 19,
  },
});
