import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../components/ButtomNav";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";

export function ProfileScreen() {
  const { logout, user: authUser } = useAuth();
  const { modules, assessments, profile } = useStore();

  const getModuleReport = (moduleId: string) => {
    const moduleAssessments = assessments.filter(
      (a) => a.moduleId === moduleId,
    );
    const completedAssessments = moduleAssessments.filter((a) => a.completed);
    const averageScore =
      completedAssessments.length > 0
        ? Math.round(
            completedAssessments.reduce((sum, a) => sum + (a.score || 0), 0) /
              completedAssessments.length,
          )
        : 0;

    return {
      averageScore,
      completedAssessments: completedAssessments.length,
      totalAssessments: moduleAssessments.length,
    };
  };

  const academicLevelMap: Record<string, string> = {
    "high-school": "High School",
    undergraduate: "Undergraduate",
    graduate: "Graduate",
    phd: "PhD",
  };

  const studyStyleMap: Record<string, string> = {
    visual: "Visual Learner",
    auditory: "Auditory Learner",
    reading: "Reading/Writing Learner",
    kinesthetic: "Kinesthetic Learner",
  };

  const academicGoalMap: Record<string, string> = {
    graduate: "Graduate with Honors",
    master: "Master the Subject",
    pass: "Pass the Course",
    exam: "Prepare for Exams",
    improve: "Improve Grades",
  };

  const fieldOfStudyMap: Record<string, string> = {
    "computer-science": "Computer Science",
    engineering: "Engineering",
    business: "Business",
    medicine: "Medicine",
    law: "Law",
    arts: "Arts & Humanities",
    sciences: "Natural Sciences",
    "social-sciences": "Social Sciences",
    other: "Other",
  };

  const preferredStudyTimeMap: Record<string, string> = {
    morning: "Morning (6 AM - 12 PM)",
    afternoon: "Afternoon (12 PM - 6 PM)",
    evening: "Evening (6 PM - 10 PM)",
    night: "Night (10 PM - 2 AM)",
  };

  const handleClearData = () => {
    Alert.alert(
      "Clear All Data",
      "Are you sure you want to clear all data and logout? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear & Logout",
          style: "destructive",
          onPress: async () => {
            await logout();
          },
        },
      ],
    );
  };

  const menuItems = [
    { id: "edit-profile", label: "Edit Profile", icon: "create-outline" },
    { id: "study-goals", label: "Study Goals", icon: "flag-outline" },
    {
      id: "progress-reports",
      label: "Progress Reports",
      icon: "bar-chart-outline",
    },
    { id: "settings", label: "Settings", icon: "settings-outline" },
    {
      id: "help-support",
      label: "Help & Support",
      icon: "help-circle-outline",
    },
    {
      id: "about",
      label: "About Study Mate",
      icon: "information-circle-outline",
    },
    { id: "logout", label: "Logout", icon: "log-out-outline", isDanger: true },
  ];

  const handleMenuItemPress = (itemId: string) => {
    switch (itemId) {
      case "edit-profile":
        // Navigate to edit profile
        break;
      case "study-goals":
        // Navigate to study goals
        break;
      case "progress-reports":
        // Navigate to progress reports
        break;
      case "settings":
        // Navigate to settings
        break;
      case "help-support":
        // Navigate to help & support
        break;
      case "about":
        // Navigate to about
        break;
      case "logout":
        handleClearData();
        break;
      default:
        break;
    }
  };

  // Get user's display name from email or profile
  const displayName = authUser?.email?.split("@")[0] || "Student";
  const formattedName = displayName
    .split(".")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={60} color="white" />
          </View>
          <Text style={styles.userName}>{formattedName || "Student"}</Text>
          <Text style={styles.userEmail}>{authUser?.email}</Text>
          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Ionicons name="school-outline" size={14} color="#8b5cf6" />
              <Text style={styles.badgeText}>
                {academicLevelMap[profile?.academicLevel || ""] || "Student"}
              </Text>
            </View>
            <View style={styles.badge}>
              <Ionicons name="book-outline" size={14} color="#8b5cf6" />
              <Text style={styles.badgeText}>
                {fieldOfStudyMap[profile?.fieldOfStudy || ""] ||
                  "Not specified"}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{modules.length}</Text>
            <Text style={styles.statLabel}>Modules</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {profile?.studyHoursPerDay || 0}h
            </Text>
            <Text style={styles.statLabel}>Daily Study</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {profile?.studyDaysPerWeek || 0}d
            </Text>
            <Text style={styles.statLabel}>Study Days</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                index === menuItems.length - 1 && styles.menuItemLast,
              ]}
              onPress={() => handleMenuItemPress(item.id)}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons
                  name={item.icon as any}
                  size={24}
                  color={item.isDanger ? "#ef4444" : "#6b7280"}
                />
                <Text
                  style={[
                    styles.menuItemText,
                    item.isDanger && styles.menuItemTextDanger,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
            </TouchableOpacity>
          ))}
        </View>

        {/* App Version */}
        <Text style={styles.versionText}>Study Mate v1.0.0</Text>
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollContent: {
    paddingBottom: 20,
  },
  profileHeader: {
    backgroundColor: "white",
    paddingTop: 40,
    paddingBottom: 24,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#8b5cf6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#8b5cf6",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
  },
  badgeContainer: {
    flexDirection: "row",
    gap: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  badgeText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: -12,
    borderRadius: 12,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: "#e5e7eb",
  },
  menuContainer: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
  },
  menuItemTextDanger: {
    color: "#ef4444",
  },
  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 24,
    marginBottom: 8,
  },
});
