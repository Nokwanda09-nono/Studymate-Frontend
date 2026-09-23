// src/screens/ModuleDetailScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import {
    useNavigation,
    useRoute,
} from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import React, { useState } from "react";
import {
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CustomButton } from "../components/CustomButton";
import { CustomCard } from "../components/CustomCard";
import { useStore } from "../context/StoreContext";
import {
    deletePersistedFile,
    persistPickedFile,
} from "../lib/fileStorage";

// ---------------------------------------------------------
// Supported document types
// ---------------------------------------------------------

const DOCUMENT_TYPES = [
  "application/pdf",

  // Images
  "image/*",

  // Text
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

export function ModuleDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();

  const { id } = route.params as {
    id: string;
  };

  const {
    modules,
    files,
    addFile,
    deleteFile,
  } = useStore();

  const [refreshing, setRefreshing] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  // -------------------------------------------------------
  // Find module
  // -------------------------------------------------------

  const module = modules.find(
    (item) => item.id === id
  );

  const moduleFiles = files.filter(
    (file) => file.moduleId === id
  );

  // -------------------------------------------------------
  // Module not found
  // -------------------------------------------------------

  if (!module) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <View
          style={styles.errorContainer}
        >
          <View
            style={
              styles.errorIconContainer
            }
          >
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color="#ef4444"
            />
          </View>

          <Text
            style={styles.errorTitle}
          >
            Module not found
          </Text>

          <Text
            style={styles.errorText}
          >
            This module may have been deleted
            or is no longer available.
          </Text>

          <CustomButton
            title="Go Back"
            onPress={() =>
              navigation.goBack()
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------
  // Upload files
  // -------------------------------------------------------

  const handleFileUpload =
    async () => {
      if (uploading) {
        return;
      }

      try {
        setUploading(true);

        const result =
          await DocumentPicker.getDocumentAsync(
            {
              type: DOCUMENT_TYPES,
              multiple: true,
              copyToCacheDirectory: true,
            }
          );

        // User cancelled the picker.
        if (result.canceled) {
          setUploading(false);
          return;
        }

        const selectedFiles =
          result.assets ?? [];

        if (
          selectedFiles.length === 0
        ) {
          setUploading(false);

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
             * uploadedAt is stored as an ISO string because
             * AsyncStorage serializes JSON.
             */
            const fileItem = {
              id: `${module.id}-${Date.now()}-${Math.random()
                .toString(36)
                .substring(2, 10)}`,

              moduleId: module.id,

              name:
                file.name ||
                "Untitled file",

              type:
                file.mimeType ||
                "application/octet-stream",

              size:
                file.size ?? 0,

              /*
               * Permanent URI. The AI document-processing
               * system will use this later.
               */
              uri: permanentUri,

              uploadedAt:
                new Date().toISOString(),
            };

            addFile(fileItem);

            uploadedCount++;
          } catch (fileError) {
            console.error(
              `Failed to add file ${file.name}:`,
              fileError
            );
          }
        }

        setUploading(false);

        if (uploadedCount > 0) {
          Alert.alert(
            "Files uploaded",
            `${uploadedCount} file${
              uploadedCount === 1
                ? ""
                : "s"
            } successfully added to ${module.name}.`
          );
        } else {
          Alert.alert(
            "Upload failed",
            "The selected files could not be added."
          );
        }
      } catch (error) {
        console.error(
          "Document upload error:",
          error
        );

        setUploading(false);

        Alert.alert(
          "Upload error",
          "Something went wrong while selecting or adding your files. Please try again."
        );
      }
    };

  // -------------------------------------------------------
  // Delete file
  // -------------------------------------------------------

  const handleDeleteFile = (
    fileId: string,
    fileName: string
  ) => {
    Alert.alert(
      "Delete File",
      `Are you sure you want to delete "${fileName}"?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },

        {
          text: "Delete",
          style: "destructive",

          onPress: async () => {
            try {
              const target = files.find(
                (f) => f.id === fileId
              );

              // Remove the physical file first.
              if (target?.uri) {
                await deletePersistedFile(
                  target.uri
                );
              }

              // Then remove the metadata from the store.
              deleteFile(fileId);
            } catch (error) {
              console.error(
                "Delete file error:",
                error
              );

              Alert.alert(
                "Error",
                "The file could not be deleted."
              );
            }
          },
        },
      ]
    );
  };

  // -------------------------------------------------------
  // File icon
  // -------------------------------------------------------

  const getFileIcon = (
    type: string
  ): keyof typeof Ionicons.glyphMap => {
    const normalizedType =
      type.toLowerCase();

    if (
      normalizedType.includes("pdf")
    ) {
      return "document-text";
    }

    if (
      normalizedType.includes(
        "image"
      ) ||
      normalizedType.includes(
        "png"
      ) ||
      normalizedType.includes(
        "jpeg"
      ) ||
      normalizedType.includes(
        "jpg"
      )
    ) {
      return "image";
    }

    if (
      normalizedType.includes(
        "word"
      ) ||
      normalizedType.includes(
        "document"
      )
    ) {
      return "document";
    }

    if (
      normalizedType.includes(
        "powerpoint"
      ) ||
      normalizedType.includes(
        "presentation"
      )
    ) {
      return "easel";
    }

    if (
      normalizedType.includes(
        "excel"
      ) ||
      normalizedType.includes(
        "spreadsheet"
      )
    ) {
      return "grid";
    }

    if (
      normalizedType.includes(
        "text"
      )
    ) {
      return "document-text";
    }

    return "document";
  };

  // -------------------------------------------------------
  // File color
  // -------------------------------------------------------

  const getFileColor = (
    type: string
  ) => {
    const normalizedType =
      type.toLowerCase();

    if (
      normalizedType.includes("pdf")
    ) {
      return "#ef4444";
    }

    if (
      normalizedType.includes(
        "image"
      )
    ) {
      return "#3b82f6";
    }

    if (
      normalizedType.includes(
        "word"
      ) ||
      normalizedType.includes(
        "document"
      )
    ) {
      return "#2563eb";
    }

    if (
      normalizedType.includes(
        "powerpoint"
      ) ||
      normalizedType.includes(
        "presentation"
      )
    ) {
      return "#ea580c";
    }

    if (
      normalizedType.includes(
        "excel"
      ) ||
      normalizedType.includes(
        "spreadsheet"
      )
    ) {
      return "#16a34a";
    }

    if (
      normalizedType.includes(
        "text"
      )
    ) {
      return "#059669";
    }

    return "#6b7280";
  };

  // -------------------------------------------------------
  // File size
  // -------------------------------------------------------

  const formatFileSize = (
    bytes: number
  ) => {
    if (!bytes || bytes <= 0) {
      return "Unknown size";
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (
      bytes <
      1024 * 1024
    ) {
      return `${(
        bytes / 1024
      ).toFixed(1)} KB`;
    }

    if (
      bytes <
      1024 *
        1024 *
        1024
    ) {
      return `${(
        bytes /
        (1024 * 1024)
      ).toFixed(1)} MB`;
    }

    return `${(
      bytes /
      (1024 *
        1024 *
        1024)
    ).toFixed(1)} GB`;
  };

  // -------------------------------------------------------
  // File press — navigate to FileViewer
  // -------------------------------------------------------

  const handleFilePress = (file: {
    id: string;
  }) => {
    navigation.navigate("FileViewer", {
      id: file.id,
    });
  };

  // -------------------------------------------------------
  // Refresh
  // -------------------------------------------------------

  const onRefresh = () => {
    setRefreshing(true);

    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  };

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------

  return (
    <SafeAreaView
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <View
          style={styles.headerContent}
        >
          <TouchableOpacity
            onPress={() =>
              navigation.goBack()
            }
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color="#111827"
            />
          </TouchableOpacity>

          <View
            style={styles.headerInfo}
          >
            <Text
              style={styles.headerTitle}
              numberOfLines={1}
            >
              {module.name}
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              {moduleFiles.length}{" "}
              {moduleFiles.length === 1
                ? "file"
                : "files"}
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        {/* Upload */}
        <CustomButton
          title={
            uploading
              ? "Selecting files..."
              : "Upload Files"
          }
          onPress={
            handleFileUpload
          }
          size="large"
          style={styles.uploadButton}
          disabled={uploading}
          icon={
            <Ionicons
              name="cloud-upload"
              size={20}
              color="white"
            />
          }
        />

        {/* Supported files */}
        <View
          style={
            styles.supportedContainer
          }
        >
          <Ionicons
            name="information-circle-outline"
            size={18}
            color="#6b7280"
          />

          <Text
            style={styles.supportedText}
          >
            PDFs, Word documents,
            PowerPoint, Excel, images
            and text files
          </Text>
        </View>

        {/* Empty state */}
        {moduleFiles.length ===
        0 ? (
          <View
            style={styles.emptyState}
          >
            <View
              style={
                styles.emptyStateIconContainer
              }
            >
              <Ionicons
                name="document-outline"
                size={64}
                color="#d1d5db"
              />
            </View>

            <Text
              style={
                styles.emptyStateTitle
              }
            >
              No files yet
            </Text>

            <Text
              style={
                styles.emptyStateText
              }
            >
              Upload your study materials
              to get started with this
              module.
            </Text>
          </View>
        ) : (
          <View
            style={styles.filesList}
          >
            {moduleFiles.map(
              (file) => {
                const fileColor =
                  getFileColor(
                    file.type
                  );

                const fileIcon =
                  getFileIcon(
                    file.type
                  );

                return (
                  <CustomCard
                    key={file.id}
                    style={
                      styles.fileCard
                    }
                  >
                    <View
                      style={
                        styles.fileContent
                      }
                    >
                      {/* File button */}
                      <TouchableOpacity
                        style={
                          styles.fileMainButton
                        }
                        onPress={() =>
                          handleFilePress(
                            file
                          )
                        }
                        activeOpacity={
                          0.7
                        }
                      >
                        <View
                          style={[
                            styles.fileIconContainer,
                            {
                              backgroundColor:
                                `${fileColor}20`,
                            },
                          ]}
                        >
                          <Ionicons
                            name={
                              fileIcon
                            }
                            size={30}
                            color={
                              fileColor
                            }
                          />
                        </View>

                        <View
                          style={
                            styles.fileInfo
                          }
                        >
                          <Text
                            style={
                              styles.fileName
                            }
                            numberOfLines={
                              2
                            }
                          >
                            {file.name}
                          </Text>

                          <View
                            style={
                              styles.fileMeta
                            }
                          >
                            <Text
                              style={
                                styles.fileSize
                              }
                            >
                              {formatFileSize(
                                file.size
                              )}
                            </Text>

                            <Text
                              style={
                                styles.fileDate
                              }
                            >
                              {new Date(
                                file.uploadedAt
                              ).toLocaleDateString()}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>

                      {/* Delete */}
                      <TouchableOpacity
                        onPress={() =>
                          handleDeleteFile(
                            file.id,
                            file.name
                          )
                        }
                        style={
                          styles.deleteFileButton
                        }
                        activeOpacity={
                          0.7
                        }
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color="#ef4444"
                        />
                      </TouchableOpacity>
                    </View>
                  </CustomCard>
                );
              }
            )}
          </View>
        )}
      </ScrollView>
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

  header: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  backButton: {
    padding: 4,
  },

  headerInfo: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },

  headerSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },

  uploadButton: {
    marginBottom: 12,
  },

  supportedContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 24,
  },

  supportedText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: "#6b7280",
  },

  filesList: {
    gap: 12,
  },

  fileCard: {
    padding: 0,
    overflow: "hidden",
    marginBottom: 12,
  },

  fileContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 10,
  },

  fileMainButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  fileIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  fileInfo: {
    flex: 1,
  },

  fileName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 5,
  },

  fileMeta: {
    flexDirection: "row",
    gap: 12,
  },

  fileSize: {
    fontSize: 12,
    color: "#6b7280",
  },

  fileDate: {
    fontSize: 12,
    color: "#6b7280",
  },

  deleteFileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef2f2",
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: 64,
    paddingHorizontal: 24,
  },

  emptyStateIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
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
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 21,
  },

  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  errorIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },

  errorText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 21,
  },
});