import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { getAvatarOption } from "../lib/avatarOptions";

interface ProfileAvatarProps {
  avatarId?: string | null;
  size: number;
  iconColor?: string;
}

export function ProfileAvatar({
  avatarId,
  size,
  iconColor = "#4b5563",
}: ProfileAvatarProps) {
  const avatar = getAvatarOption(avatarId);

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: avatar.color },
      ]}
    >
      {avatar.emoji ? (
        <Text style={{ fontSize: size * 0.58 }}>{avatar.emoji}</Text>
      ) : (
        <Ionicons name="person" size={size * 0.68} color={iconColor} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
