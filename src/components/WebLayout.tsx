// src/components/WebLayout.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useStore } from "../context/StoreContext";

type RootStackParamList = {
  Home: undefined;
  Modules: undefined;
  Schedule: undefined;
  AIChat: undefined;
  Profile: undefined;
  ModuleDetail: { id: string };
  FileViewer: { id: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface NavItem {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: "Home" | "Modules" | "Schedule" | "AIChat" | "Profile";
}

const navItems: NavItem[] = [
  { name: "Home", icon: "home-outline", route: "Home" },
  { name: "Modules", icon: "grid-outline", route: "Modules" },
  { name: "Schedules", icon: "calendar-outline", route: "Schedule" },
  { name: "AI Chat", icon: "chatbubble-ellipses-outline", route: "AIChat" },
  { name: "Profile", icon: "person-outline", route: "Profile" },
];

export function WebLayout({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { modules, files } = useStore();

  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  const recentFiles = files.slice(-5).reverse();

  return (
    <View style={styles.webShell}>
      {/* ZEUSLEARN STYLE LEFT SIDEBAR */}
      <View style={styles.sidebar}>
        {/* Brand Header */}
        <View style={styles.brandRow}>
          <View style={styles.brandLogo}>
            <Ionicons name="school" size={22} color="white" />
          </View>
          <Text style={styles.brandText}>StudyMate</Text>
        </View>

        <ScrollView style={styles.sidebarScroll} showsVerticalScrollIndicator={false}>
          {/* Main Navigation Links */}
          <View style={styles.navGroup}>
            {navItems.map((item) => {
              const isActive = route.name === item.route;
              return (
                <TouchableOpacity
                  key={item.name}
                  style={[styles.navButton, isActive && styles.navButtonActive]}
                  onPress={() => navigation.navigate(item.route)}
                >
                  <Ionicons
                    name={(isActive ? item.icon.replace("-outline", "") : item.icon) as any}
                    size={19}
                    color={isActive ? "#6366f1" : "#64748b"}
                  />
                  <Text style={[styles.navText, isActive && styles.navTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Modules Section (Replacing Subjects) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>MODULES</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Modules")}>
              <Ionicons name="add" size={18} color="#6366f1" />
            </TouchableOpacity>
          </View>

          <View style={styles.listGroup}>
            {modules.length === 0 ? (
              <Text style={styles.emptyNavText}>No modules yet</Text>
            ) : (
              modules.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={styles.moduleNavItem}
                  onPress={() => navigation.navigate("ModuleDetail", { id: m.id })}
                >
                  <View style={[styles.colorDot, { backgroundColor: m.color || "#6366f1" }]} />
                  <Text style={styles.moduleNavText} numberOfLines={1}>
                    {m.name}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Recents Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RECENTS</Text>
          </View>

          <View style={styles.listGroup}>
            {recentFiles.length === 0 ? (
              <Text style={styles.emptyNavText}>No recent files</Text>
            ) : (
              recentFiles.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={styles.recentNavItem}
                  onPress={() => navigation.navigate("FileViewer", { id: f.id })}
                >
                  <Ionicons name="document-text-outline" size={16} color="#64748b" />
                  <Text style={styles.recentNavText} numberOfLines={1}>
                    {f.name}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      </View>

      {/* RIGHT MAIN WORKSPACE */}
      <View style={styles.mainWorkspace}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  webShell: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    height: "100vh" as any,
    overflow: "hidden",
  },
  sidebar: {
    width: 250,
    backgroundColor: "white",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
    display: "flex",
    flexDirection: "column",
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  brandLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  sidebarScroll: {
    flex: 1,
  },
  navGroup: {
    gap: 4,
    marginBottom: 24,
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    cursor: "pointer" as any,
  },
  navButtonActive: {
    backgroundColor: "#eef2ff",
  },
  navText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#475569",
  },
  navTextActive: {
    color: "#6366f1",
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: 0.8,
  },
  listGroup: {
    gap: 4,
    marginBottom: 20,
  },
  moduleNavItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    cursor: "pointer" as any,
  },
  colorDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  moduleNavText: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "500",
    flex: 1,
  },
  recentNavItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 6,
    cursor: "pointer" as any,
  },
  recentNavText: {
    fontSize: 12,
    color: "#64748b",
    flex: 1,
  },
  emptyNavText: {
    fontSize: 12,
    color: "#94a3b8",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mainWorkspace: {
    flex: 1,
    backgroundColor: "#f8fafc",
    overflow: "hidden",
  },
});
