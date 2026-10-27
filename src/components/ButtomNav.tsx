// src/components/ButtomNav.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Define the navigation param list
type RootStackParamList = {
  Home: undefined;
  Modules: undefined;
  Schedule: undefined;
  AIChat: undefined;
  Profile: undefined;
  ModuleDetail: { id: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Define the nav item type
interface NavItem {
  name: string;
  icon: keyof typeof Ionicons.glyphMap; // This ensures valid icon names
  route: "Home" | "Modules" | "Schedule" | "AIChat" | "Profile";
}

const navItems: NavItem[] = [
  { name: "Home", icon: "home-outline", route: "Home" },
  { name: "Modules", icon: "grid-outline", route: "Modules" },
  { name: "Schedules", icon: "calendar-outline", route: "Schedule" },
  { name: "AI Chat", icon: "chatbubble-ellipses-outline", route: "AIChat" },
  { name: "Profile", icon: "person-outline", route: "Profile" },
];

export function BottomNav() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();

  if (Platform.OS === "web") {
    return null;
  }

  return (
    <View style={styles.container}>
      {navItems.map((item) => {
        const isActive = route.name === item.route;
        return (
          <TouchableOpacity
            key={item.name}
            style={[
              styles.navItem,
              isActive && styles.navItemActive,
            ]}
            onPress={() => navigation.navigate(item.route)}
          >
            <Ionicons
              name={(isActive ? item.icon.replace('-outline', '') : item.icon) as any}
              size={22}
              color={isActive ? "#6366f1" : "#6b7280"}
            />
            <Text style={[styles.navText, isActive && styles.navTextActive]}>
              {item.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingVertical: 8,
    paddingBottom: Platform.OS === "web" ? 10 : 20,
    paddingHorizontal: 8,
    justifyContent: "space-around",
    width: "100%",
    maxWidth: Platform.OS === "web" ? 640 : "100%",
    alignSelf: "center",
  },
  webContainer: {
    borderTopWidth: 0,
    borderRadius: 20,
    marginVertical: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  navItem: {
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  navItemActive: {
    backgroundColor: Platform.OS === 'web' ? '#eef2ff' : 'transparent',
  },
  navText: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
    fontWeight: "500",
  },
  navTextActive: {
    color: "#6366f1",
    fontWeight: "700",
  },
});
