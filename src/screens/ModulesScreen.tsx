// src/screens/ModulesScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as DocumentPicker from "expo-document-picker";
import React, { useState } from "react";
import {
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";


import { AnimatedModal } from "../components/AnimatedModal";
import { BottomNav } from "../components/ButtomNav";
import { CustomButton } from "../components/CustomButton";
import { CustomCard } from "../components/CustomCard";
import { useStore } from "../context/StoreContext";
import { persistPickedFile } from "../lib/fileStorage";
import { Module } from "../lib/store";

// ---------------------------------------------------------
// Navigation
// ---------------------------------------------------------

type RootStackParamList = {
  Home: undefined;
  Modules: undefined;
  ModuleDetail: { id: string };
  FileViewer: { id: string };
  Schedule: undefined;
  AIChat: undefined;
  Profile: undefined;
};

type NavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

// ---------------------------------------------------------
// Constants
// ---------------------------------------------------------

const MODULE_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#a855f7",
  "#ec4899",
  "#6366f1",
  "#f97316",
];

// Supported study material types.
const DOCUMENT_TYPES = [
  "application/pdf",

  // Images
  "image/*",

  // Plain text
  "text/*",

  // Microsoft Word
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  // Microsoft PowerPoint
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  // Microsoft Excel
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

// ---------------------------------------------------------
// Component
// ---------------------------------------------------------

export function ModulesScreen() {
  const navigation =
    useNavigation<NavigationProp>();

  const {
    modules,
    addModule,
    addFile,
  } = useStore();

  const [modalVisible, setModalVisible] =
    useState(false);

  const [newModuleName, setNewModuleName] =
    useState("");

  const [selectedColor, setSelectedColor] =
    useState(MODULE_COLORS[0]);

  const [uploadingModuleId, setUploadingModuleId] =
    useState<string | null>(null);

  // -------------------------------------------------------
  // Create module
  // -------------------------------------------------------

  const handleCreateModule = () => {
    const trimmedName =
      newModuleName.trim();

    if (!trimmedName) {
      Alert.alert(
        "Missing module name",
        "Please enter a module name."
      );
      return;
    }

    const newModule: Module = {
      id: `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`,

      name: trimmedName,

      color: selectedColor,

      icon: "book",

      fileCount: 0,
    };

    try {
      addModule(newModule);

      setNewModuleName("");

      setSelectedColor(
        MODULE_COLORS[0]
      );

      setModalVisible(false);
    } catch (error) {
      console.error(
        "Create module error:",
        error
      );

      Alert.alert(
        "Error",
        "The module could not be created. Please try again."
      );
    }
  };

  // -------------------------------------------------------
  // Upload files
  // -------------------------------------------------------

  const handleUploadFiles = async (
    moduleId: string
  ) => {
    if (uploadingModuleId) {
      return;
    }

    try {
      setUploadingModuleId(moduleId);

      const result =
        await DocumentPicker.getDocumentAsync({
          type: DOCUMENT_TYPES,
          multiple: true,
          copyToCacheDirectory: true,
        });

      // User cancelled the picker.
      if (result.canceled) {
        setUploadingModuleId(null);
        return;
      }

      const selectedFiles =
        result.assets ?? [];

      if (selectedFiles.length === 0) {
        setUploadingModuleId(null);

        Alert.alert(
          "No files selected",
          "Please select at least one file."
        );

        return;
      }

      let uploadedCount = 0;

      for (const file of selectedFiles) {
        try {
          // Copy the picked file into permanent app storage
          // so the URI doesn't get wiped when the OS clears
          // the cache directory.
          const permanentUri =
            await persistPickedFile({
              uri: file.uri,
              name:
                file.name ||
                "Untitled file",
            });

          /*
           * Every uploaded file gets:
           * - a unique ID
           * - its module ID
           * - its original name
           * - MIME type
           * - size
           * - permanent local URI
           * - ISO upload timestamp
           */
          const newFile = {
            id: `${moduleId}-${permanentUri}`,

            moduleId,

            name:
              file.name ||
              "Untitled file",

            type:
              file.mimeType ||
              "application/octet-stream",

            size:
              file.size ?? 0,

            uri: permanentUri,

            uploadedAt:
              new Date().toISOString(),
          };

          addFile(newFile);

          uploadedCount++;
        } catch (fileError) {
          console.error(
            `Error adding file "${file.name}":`,
            fileError
          );
        }
      }

      setUploadingModuleId(null);

      if (uploadedCount > 0) {
        Alert.alert(
          "Upload successful",
          `${uploadedCount} file${
            uploadedCount === 1
              ? ""
              : "s"
          } added to the module.`
        );
      } else {
        Alert.alert(
          "Upload failed",
          "The selected files could not be added."
        );
      }
    } catch (error) {
      console.error(
        "Document picker error:",
        error
      );

      setUploadingModuleId(null);

      Alert.alert(
        "Upload error",
        "Something went wrong while selecting the files. Please try again."
      );
    }
  };

  // -------------------------------------------------------
  // Render module
  // -------------------------------------------------------

  const renderModule = ({
    item,
  }: {
    item: Module;
  }) => {
    const isUploading =
      uploadingModuleId === item.id;

    return (
      <CustomCard
        style={styles.moduleCard}
        onPress={() =>
          navigation.navigate(
            "ModuleDetail",
            {
              id: item.id,
            }
          )
        }
      >
        <View
          style={[
            styles.moduleIcon,
            {
              backgroundColor:
                item.color ||
                "#0b230b",
            },
          ]}
        >
          <Ionicons
            name="book"
            size={28}
            color="white"
          />
        </View>

        <Text
          style={styles.moduleName}
          numberOfLines={2}
        >
          {item.name}
        </Text>

        <View
          style={styles.moduleStats}
        >
          <Ionicons
            name="document-text-outline"
            size={14}
            color="#6b7280"
          />

          <Text
            style={
              styles.moduleFileCount
            }
          >
            {item.fileCount || 0} files
          </Text>
        </View>

        {/* Upload button */}
        <TouchableOpacity
          style={[
            styles.uploadButton,
            isUploading &&
              styles.uploadButtonDisabled,
          ]}
          onPress={() =>
            handleUploadFiles(
              item.id
            )
          }
          activeOpacity={0.7}
          disabled={Boolean(
            uploadingModuleId
          )}
        >
          <Ionicons
            name={
              isUploading
                ? "hourglass-outline"
                : "cloud-upload-outline"
            }
            size={20}
            color="#35ce61"
          />
        </TouchableOpacity>
      </CustomCard>
    );
  };

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top"]}
    >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        {/* Header */}
        <View
          style={styles.headerSection}
        >
          <Text style={styles.title}>
  {"Let's Study"}
</Text>

          <Text
            style={styles.subtitle}
          >
            Organize your study materials by
            module
          </Text>
        </View>

        {/* Create module */}
        <TouchableOpacity
          style={styles.createButton}
          onPress={() =>
            setModalVisible(true)
          }
          activeOpacity={0.7}
        >
          <Ionicons
            name="add-circle"
            size={24}
            color="#35ce61"
          />

          <Text
            style={
              styles.createButtonText
            }
          >
            Create New Module
          </Text>
        </TouchableOpacity>

        {/* Modules */}
        {modules.length === 0 ? (
          <View
            style={styles.emptyState}
          >
            <View
              style={
                styles.emptyStateIconContainer
              }
            >
              <Ionicons
                name="folder-open-outline"
                size={64}
                color="#d1d5db"
              />
            </View>

            <Text
              style={
                styles.emptyStateTitle
              }
            >
              No modules yet
            </Text>

            <Text
              style={
                styles.emptyStateText
              }
            >
              Create your first module to
              start{"\n"}
              organizing your study
              materials
            </Text>
          </View>
        ) : (
          <FlatList
            data={modules}
            renderItem={
              renderModule
            }
            keyExtractor={(item) =>
              item.id
            }
            numColumns={2}
            columnWrapperStyle={
              styles.modulesGrid
            }
            contentContainerStyle={
              styles.modulesList
            }
            showsVerticalScrollIndicator={
              false
            }
            scrollEnabled={false}
          />
        )}
      </ScrollView>

      {/* Create Module Modal */}
      <AnimatedModal
        visible={modalVisible}
        onClose={() =>
          setModalVisible(false)
        }
        title="Create New Module"
      >
        <View
          style={styles.modalContent}
        >
          <Text
            style={styles.modalLabel}
          >
            Module Name
          </Text>

          <TextInput
            style={styles.modalInput}
            placeholder="e.g., Project Management"
            placeholderTextColor="#9ca3af"
            value={newModuleName}
            onChangeText={
              setNewModuleName
            }
            autoCapitalize="words"
            returnKeyType="done"
          />

          <Text
            style={styles.modalLabel}
          >
            Choose Color
          </Text>

          <View
            style={styles.colorGrid}
          >
            {MODULE_COLORS.map(
              (color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    {
                      backgroundColor:
                        color,
                    },
                    selectedColor ===
                      color &&
                      styles.colorSelected,
                  ]}
                  onPress={() =>
                    setSelectedColor(
                      color
                    )
                  }
                  activeOpacity={0.8}
                />
              )
            )}
          </View>

          <CustomButton
            title="Create Module"
            onPress={
              handleCreateModule
            }
          />
        </View>
      </AnimatedModal>

      <BottomNav />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------
// Styles
// ---------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 100,
  },

  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    fontWeight: "400",
  },

  createButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    marginHorizontal: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 20,
  },

  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#070f0b",
    marginLeft: 8,
  },

  modulesList: {
    paddingHorizontal: 16,
  },

  modulesGrid: {
    justifyContent:
      "space-between",
  },

  moduleCard: {
    width: "48%",
    marginBottom: 16,
    alignItems: "center",
    padding: 16,
    backgroundColor: "white",
    borderRadius: 12,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,

    elevation: 2,
  },

  moduleIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  moduleName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
    marginBottom: 6,
  },

  moduleStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  moduleFileCount: {
    fontSize: 12,
    color: "#6b7280",
  },

  uploadButton: {
    marginTop: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },

  uploadButtonDisabled: {
    opacity: 0.5,
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },

  emptyStateIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },

  emptyStateText: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
  },

  modalContent: {
    gap: 16,
  },

  modalLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 4,
  },

  modalInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#f9fafb",
    color: "#111827",
  },

  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },

  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  colorSelected: {
    borderWidth: 3,
    borderColor: "#111827",
  },
});