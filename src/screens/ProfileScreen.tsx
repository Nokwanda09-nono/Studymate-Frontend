import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BottomNav } from "../components/ButtomNav";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";

const { width } = Dimensions.get("window");

interface DropdownOption {
  label: string;
  value: string;
}

interface EditableProfile {
  firstName: string;
  lastName: string;
  academicLevel: string;
  fieldOfStudy: string;
  academicGoal: string;
  studyStyle: string;
  studyHoursPerDay: string;
  studyDaysPerWeek: string;
  preferredStudyTime: string;
  studyChallenges: string[];
}

export function ProfileScreen() {
  const { logout, user: authUser, updateUser } = useAuth();
  const { profile, setProfile } = useStore();

  const userProf: any = authUser?.profile || profile || {};

  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<EditableProfile>({
    firstName: authUser?.firstName || "",
    lastName: authUser?.lastName || "",
    academicLevel: userProf.qualification || userProf.academicLevel || "",
    fieldOfStudy: userProf.fieldOfStudy || "",
    academicGoal: userProf.academicGoal || "",
    studyStyle: userProf.learningStyle || userProf.studyStyle || "",
    studyHoursPerDay: String(userProf.studyHours || userProf.studyHoursPerDay || ""),
    studyDaysPerWeek: String(userProf.studyDaysPerWeek || ""),
    preferredStudyTime: userProf.productiveTime || userProf.preferredStudyTime || "",
    studyChallenges: userProf.studyChallenges || [],
  });

  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOption[]>([]);
  const [dropdownField, setDropdownField] = useState<string>("");

  const dropdownData: Record<string, DropdownOption[]> = {
    academicLevel: [
      { label: "High School", value: "high-school" },
      { label: "Undergraduate", value: "undergraduate" },
      { label: "Graduate", value: "graduate" },
      { label: "PhD", value: "phd" },
    ],
    fieldOfStudy: [
      { label: "Computer Science", value: "computer-science" },
      { label: "Engineering", value: "engineering" },
      { label: "Business", value: "business" },
      { label: "Medicine", value: "medicine" },
      { label: "Law", value: "law" },
      { label: "Arts & Humanities", value: "arts" },
      { label: "Natural Sciences", value: "sciences" },
      { label: "Social Sciences", value: "social-sciences" },
      { label: "Other", value: "other" },
    ],
    academicGoal: [
      { label: "Pass all my modules", value: "pass" },
      { label: "Improve my grades", value: "improve" },
      { label: "Achieve distinctions", value: "distinctions" },
      { label: "Graduate this year", value: "graduate" },
    ],
    studyStyle: [
      { label: "Reading notes", value: "reading" },
      { label: "Watching videos", value: "videos" },
      { label: "Practice questions", value: "practice" },
      { label: "A combination of all", value: "combination" },
    ],
    preferredStudyTime: [
      { label: "Morning (6 AM - 12 PM)", value: "morning" },
      { label: "Afternoon (12 PM - 4 PM)", value: "afternoon" },
      { label: "Evening (4 PM - 9 PM)", value: "evening" },
      { label: "Late night (9 PM - 2 AM)", value: "late-night" },
    ],
    studyChallenges: [
      { label: "Time management", value: "time-management" },
      { label: "Understanding difficult concepts", value: "understanding" },
      { label: "Remembering information", value: "remembering" },
      { label: "Staying motivated", value: "motivation" },
      { label: "Exam anxiety", value: "exam-anxiety" },
    ],
  };

  const displayMaps: Record<string, Record<string, string>> = {
    academicLevel: {
      "high-school": "High School",
      undergraduate: "Undergraduate",
      graduate: "Graduate",
      phd: "PhD",
    },
    fieldOfStudy: {
      "computer-science": "Computer Science",
      engineering: "Engineering",
      business: "Business",
      medicine: "Medicine",
      law: "Law",
      arts: "Arts & Humanities",
      sciences: "Natural Sciences",
      "social-sciences": "Social Sciences",
      other: "Other",
    },
    academicGoal: {
      pass: "Pass all my modules",
      improve: "Improve my grades",
      distinctions: "Achieve distinctions",
      graduate: "Graduate this year",
    },
    studyStyle: {
      reading: "Reading notes",
      videos: "Watching videos",
      practice: "Practice questions",
      combination: "A combination of all",
    },
    preferredStudyTime: {
      morning: "Morning (6 AM - 12 PM)",
      afternoon: "Afternoon (12 PM - 4 PM)",
      evening: "Evening (4 PM - 9 PM)",
      "late-night": "Late night (9 PM - 2 AM)",
    },
  };

  const getDisplayName = () => {
    if (authUser?.firstName && authUser?.lastName) {
      return `${authUser.firstName} ${authUser.lastName}`;
    }
    if (authUser?.firstName) {
      return authUser.firstName;
    }
    const emailName = authUser?.email?.split("@")[0] || "Student";
    return emailName
      .split(".")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getUserRole = () => {
    const academicLevelMap: Record<string, string> = {
      "high-school": "High School Student",
      undergraduate: "Undergraduate Student",
      graduate: "Graduate Student",
      phd: "PhD Candidate",
    };
    return academicLevelMap[profile?.academicLevel || ""] || "Student";
  };

  const openDropdown = (field: string) => {
    setDropdownField(field);
    setDropdownOptions(dropdownData[field] || []);
    setShowDropdown(field);
  };

  const selectDropdownOption = (value: string) => {
    if (dropdownField === "studyChallenges") {
      const currentChallenges = editedProfile.studyChallenges || [];
      if (currentChallenges.includes(value)) {
        setEditedProfile({
          ...editedProfile,
          studyChallenges: currentChallenges.filter((c: string) => c !== value),
        });
      } else {
        setEditedProfile({
          ...editedProfile,
          studyChallenges: [...currentChallenges, value],
        });
      }
    } else {
      setEditedProfile({
        ...editedProfile,
        [dropdownField]: value,
      });
      setShowDropdown(null);
    }
  };

  const handleSave = async () => {
    try {
      await updateUser({
        firstName: editedProfile.firstName,
        lastName: editedProfile.lastName,
      });

      const profileData: any = {
        ...profile,
        academicLevel: editedProfile.academicLevel,
        fieldOfStudy: editedProfile.fieldOfStudy,
        academicGoal: editedProfile.academicGoal,
        studyStyle: editedProfile.studyStyle,
        studyHoursPerDay: Number(editedProfile.studyHoursPerDay) || 0,
        studyDaysPerWeek: Number(editedProfile.studyDaysPerWeek) || 0,
        preferredStudyTime: editedProfile.preferredStudyTime,
      };

      Object.keys(profileData).forEach((key) => {
        if (profileData[key] === undefined) {
          delete profileData[key];
        }
      });

      await setProfile(profileData);
      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to update profile. Please try again.");
    }
  };

  const handleCancel = () => {
    setEditedProfile({
      firstName: authUser?.firstName || "",
      lastName: authUser?.lastName || "",
      academicLevel: profile?.academicLevel || "",
      fieldOfStudy: profile?.fieldOfStudy || "",
      academicGoal: profile?.academicGoal || "",
      studyStyle: profile?.studyStyle || "",
      studyHoursPerDay: String(profile?.studyHoursPerDay || ""),
      studyDaysPerWeek: String(profile?.studyDaysPerWeek || ""),
      preferredStudyTime: profile?.preferredStudyTime || "",
      studyChallenges: [],
    });
    setIsEditing(false);
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: logout },
    ]);
  };

  const renderEditableField = (
    label: string,
    field: keyof EditableProfile,
    value: string,
    isDropdown: boolean = false,
    isMultiSelect: boolean = false,
    keyboardType: "default" | "numeric" = "default",
  ) => {
    if (isDropdown) {
      let displayValue = "Select an option";
      if (isMultiSelect) {
        const selected = (editedProfile.studyChallenges || [])
          .map(
            (v: string) =>
              dropdownData.studyChallenges.find(
                (d: DropdownOption) => d.value === v,
              )?.label,
          )
          .filter((label): label is string => Boolean(label))
          .join(", ");
        displayValue = selected || "Select options";
      } else {
        displayValue = displayMaps[field]?.[value] || "Select an option";
      }

      return (
        <TouchableOpacity
          style={styles.editableField}
          onPress={() => openDropdown(field)}
          activeOpacity={0.7}
        >
          <Text style={styles.fieldLabel}>{label}</Text>
          <View style={styles.dropdownContainer}>
            <Text style={[styles.fieldValue, !value && styles.placeholderText]}>
              {displayValue}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#6b7280" />
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.editableField}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={(text) =>
            setEditedProfile({ ...editedProfile, [field]: text })
          }
          keyboardType={keyboardType}
          placeholder={`Enter ${label.toLowerCase()}`}
          placeholderTextColor="#9ca3af"
        />
      </View>
    );
  };

  const renderViewField = (
    label: string,
    value: any,
    field?: string,
    icon?: string,
  ) => {
    let displayValue = value || "Not set";
    if (field && displayMaps[field]) {
      displayValue = displayMaps[field][value] || value || "Not set";
    }
    if (field === "studyChallenges" && Array.isArray(value)) {
      displayValue =
        value
          .map(
            (v: string) =>
              dropdownData.studyChallenges.find(
                (d: DropdownOption) => d.value === v,
              )?.label,
          )
          .filter((label): label is string => Boolean(label))
          .join(", ") || "Not set";
    }
    return (
      <View style={styles.viewField}>
        <View style={styles.viewFieldContent}>
          {icon && (
            <View style={styles.viewFieldIcon}>
              <Ionicons name={icon as any} size={18} color="#6366f1" />
            </View>
          )}
          <View style={styles.viewFieldText}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <Text style={styles.fieldValue}>{displayValue}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header with Gradient */}
        <LinearGradient
          colors={["#6366f1", "#8b5cf6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHeader}
        >
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={50} color="white" />
          </View>
          <Text style={styles.userName}>{getDisplayName()}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="school-outline" size={14} color="#c4b5fd" />
            <Text style={styles.userRole}>{getUserRole()}</Text>
          </View>
          <View style={styles.emailContainer}>
            <Ionicons name="mail-outline" size={16} color="#c4b5fd" />
            <Text style={styles.userEmail}>{authUser?.email}</Text>
          </View>

          {!isEditing && (
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => setIsEditing(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={18} color="#6366f1" />
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        {/* Personal Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={20} color="#6366f1" />
            <Text style={styles.sectionTitle}>Personal Information</Text>
          </View>
          <View style={styles.sectionContent}>
            {isEditing ? (
              <>
                {renderEditableField(
                  "First Name",
                  "firstName",
                  editedProfile.firstName,
                )}
                {renderEditableField(
                  "Last Name",
                  "lastName",
                  editedProfile.lastName,
                )}
              </>
            ) : (
              <>
                {renderViewField(
                  "First Name",
                  authUser?.firstName,
                  undefined,
                  "person-outline",
                )}
                {renderViewField(
                  "Last Name",
                  authUser?.lastName,
                  undefined,
                  "person-outline",
                )}
              </>
            )}
          </View>
        </View>

        {/* Academic Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="library-outline" size={20} color="#6366f1" />
            <Text style={styles.sectionTitle}>Academic Information</Text>
          </View>
          <View style={styles.sectionContent}>
            {isEditing ? (
              <>
                {renderEditableField(
                  "Academic Level",
                  "academicLevel",
                  editedProfile.academicLevel,
                  true,
                )}
                {renderEditableField(
                  "Field of Study",
                  "fieldOfStudy",
                  editedProfile.fieldOfStudy,
                  true,
                )}
                {renderEditableField(
                  "Academic Goal",
                  "academicGoal",
                  editedProfile.academicGoal,
                  true,
                )}
                {renderEditableField(
                  "Study Style",
                  "studyStyle",
                  editedProfile.studyStyle,
                  true,
                )}
                {renderEditableField(
                  "Study Hours/Day",
                  "studyHoursPerDay",
                  editedProfile.studyHoursPerDay,
                  false,
                  false,
                  "numeric",
                )}
                {renderEditableField(
                  "Study Days/Week",
                  "studyDaysPerWeek",
                  editedProfile.studyDaysPerWeek,
                  false,
                  false,
                  "numeric",
                )}
                {renderEditableField(
                  "Preferred Study Time",
                  "preferredStudyTime",
                  editedProfile.preferredStudyTime,
                  true,
                )}
                {renderEditableField(
                  "Study Challenges",
                  "studyChallenges",
                  "",
                  true,
                  true,
                )}
              </>
            ) : (
              <>
                {renderViewField(
                  "Academic Level",
                  profile?.academicLevel,
                  "academicLevel",
                  "school-outline",
                )}
                {renderViewField(
                  "Field of Study",
                  profile?.fieldOfStudy,
                  "fieldOfStudy",
                  "book-outline",
                )}
                {renderViewField(
                  "Academic Goal",
                  profile?.academicGoal,
                  "academicGoal",
                  "flag-outline",
                )}
                {renderViewField(
                  "Study Style",
                  profile?.studyStyle,
                  "studyStyle",
                  "bulb-outline",
                )}
                {renderViewField(
                  "Study Hours/Day",
                  profile?.studyHoursPerDay,
                  undefined,
                  "time-outline",
                )}
                {renderViewField(
                  "Study Days/Week",
                  profile?.studyDaysPerWeek,
                  undefined,
                  "calendar-outline",
                )}
                {renderViewField(
                  "Preferred Study Time",
                  profile?.preferredStudyTime,
                  "preferredStudyTime",
                  "moon-outline",
                )}
              </>
            )}
          </View>
        </View>

        {/* Actions */}
        {isEditing ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark" size={20} color="white" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Dropdown Modal */}
      <Modal
        visible={!!showDropdown}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDropdown(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDropdown(null)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {dropdownField === "studyChallenges"
                  ? "Select Study Challenges"
                  : `Select ${dropdownField.replace(/([A-Z])/g, " $1").trim()}`}
              </Text>
              <TouchableOpacity onPress={() => setShowDropdown(null)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {dropdownField === "studyChallenges" && (
              <View style={styles.modalSubHeader}>
                <Text style={styles.modalSubText}>Select multiple options</Text>
              </View>
            )}
            <FlatList
              data={dropdownOptions}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const isSelected =
                  dropdownField === "studyChallenges"
                    ? (editedProfile.studyChallenges || []).includes(item.value)
                    : editedProfile[dropdownField as keyof EditableProfile] ===
                      item.value;

                return (
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      isSelected && styles.modalItemSelected,
                    ]}
                    onPress={() => selectDropdownOption(item.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        isSelected && styles.modalItemTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#6366f1"
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
            {dropdownField === "studyChallenges" && (
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalDoneButton}
                  onPress={() => setShowDropdown(null)}
                >
                  <Text style={styles.modalDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  scrollContent: {
    paddingBottom: 0,
  },
  profileHeader: {
    paddingTop: 40,
    paddingBottom: 30,
    alignItems: "center",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: "white",
    marginBottom: 4,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 6,
  },
  userRole: {
    fontSize: 14,
    color: "#c4b5fd",
    fontWeight: "500",
  },
  emailContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  userEmail: {
    fontSize: 13,
    color: "#c4b5fd",
  },
  editProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "white",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editProfileText: {
    fontSize: 14,
    color: "#6366f1",
    fontWeight: "600",
  },
  section: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  sectionContent: {
    padding: 16,
  },
  viewField: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  viewFieldContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  viewFieldIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  viewFieldText: {
    flex: 1,
  },
  editableField: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  fieldValue: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "500",
  },
  placeholderText: {
    color: "#9ca3af",
    fontWeight: "400",
  },
  textInput: {
    fontSize: 15,
    color: "#111827",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#f9fafb",
    fontWeight: "500",
  },
  dropdownContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#f9fafb",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    alignItems: "center",
    backgroundColor: "white",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  saveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#6366f1",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fee2e2",
  },
  logoutText: {
    fontSize: 16,
    color: "#ef4444",
    fontWeight: "600",
  },
  bottomPadding: {
    height: 80,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  modalSubHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f9fafb",
  },
  modalSubText: {
    fontSize: 13,
    color: "#6b7280",
    fontStyle: "italic",
  },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  modalItemSelected: {
    backgroundColor: "#eef2ff",
  },
  modalItemText: {
    fontSize: 16,
    color: "#111827",
  },
  modalItemTextSelected: {
    color: "#6366f1",
    fontWeight: "600",
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  modalDoneButton: {
    backgroundColor: "#6366f1",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modalDoneText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
