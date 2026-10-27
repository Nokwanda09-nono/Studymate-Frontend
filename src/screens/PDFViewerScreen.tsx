import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

export function PDFViewerScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "PDFViewer">>();

  useEffect(() => {
    navigation.replace("FileViewer", { id: route.params.fileId });
  }, [navigation, route.params.fileId]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#35ce61" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
