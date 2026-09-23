import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import { getStudyTier } from "../utils/studyPoints";

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

const AVATAR_OPTIONS = [
  { id: "default", label: "Default", emoji: "", color: "#dbeafe" },
  { id: "fox", label: "Fox", emoji: "🦊", color: "#fed7aa" },
  { id: "panda", label: "Panda", emoji: "🐼", color: "#e0e7ff" },
  { id: "rabbit", label: "Rabbit", emoji: "🐰", color: "#fbcfe8" },
  { id: "tiger", label: "Tiger", emoji: "🐯", color: "#fde68a" },
  { id: "penguin", label: "Penguin", emoji: "🐧", color: "#bfdbfe" },
  { id: "robot", label: "Robot", emoji: "🤖", color: "#bae6fd" },
  { id: "wizard", label: "Wizard", emoji: "🧙", color: "#ddd6fe" },
  { id: "astronaut", label: "Astronaut", emoji: "🧑‍🚀", color: "#cffafe" },
  { id: "artist", label: "Artist", emoji: "🎨", color: "#fecdd3" },
];

function MetallicStudyBadge({ tier }: { tier: ReturnType<typeof getStudyTier> }) {
  const shine = useRef(new Animated.Value(-1)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const shineAnimation = Animated.loop(
      Animated.timing(shine, {
        toValue: 1,
        duration: 2600,
        useNativeDriver: true,
      }),
    );
    const orbitAnimation = Animated.loop(
      Animated.timing(orbit, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      }),
    );
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
    );
    shineAnimation.start();
    orbitAnimation.start();
    pulseAnimation.start();
    return () => {
      shineAnimation.stop();
      orbitAnimation.stop();
      pulseAnimation.stop();
    };
  }, [orbit, pulse, shine]);

  const shineX = shine.interpolate({
    inputRange: [-1, 1],
    outputRange: [-90, 170],
  });
  const orbitRotation = orbit.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.badgeArtwork}>
      <Animated.View
        style={[
          styles.badgeOrbit,
          {
            borderColor: tier.colors[1],
            transform: [{ rotate: orbitRotation }, { scale: pulse }],
          },
        ]}
      >
        <View style={[styles.badgeSpark, styles.badgeSparkTop, { backgroundColor: tier.colors[0] }]} />
        <View style={[styles.badgeSpark, styles.badgeSparkBottom, { backgroundColor: tier.colors[0] }]} />
      </Animated.View>
      <LinearGradient
        colors={tier.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.metalBadge}
      >
        <Ionicons name="trophy" size={22} color="#fff7d6" style={styles.badgeCrown} />
        <View style={styles.badgeInner}>
          <Ionicons name="shield" size={58} color="rgba(255,255,255,0.38)" />
          <Ionicons name="star" size={31} color="#fff7d6" style={styles.badgeStar} />
          <Ionicons
            name="ribbon"
            size={54}
            color="rgba(255,255,255,0.72)"
            style={styles.badgeRibbon}
          />
        </View>
        <Animated.View
          pointerEvents="none"
          style={[styles.badgeShine, { transform: [{ translateX: shineX }, { rotate: "25deg" }] }]}
        />
      </LinearGradient>
    </View>
  );
}

export function ProfileScreen() {
  const { logout, user: authUser, updateUser } = useAuth();
  const { profile, setProfile, modules, assessments } = useStore();

  const normalizeAcademicLevel = (value?: string) => {
    if (!value) return "";

    const mapping: Record<string, string> = {
      bachelor: "undergraduate",
      master: "undergraduate",
      phd: "phd",
      diploma: "graduate",
      certificate: "graduate",
      "high-school": "high-school",
      other: "undergraduate",
    };

    return mapping[value] || value;
  };

  const userProf: any = authUser?.profile || profile || {};
  const mergedProfile: any = authUser?.profile || profile || userProf || {};

  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<EditableProfile>({
    firstName: authUser?.firstName || "",
    lastName: authUser?.lastName || "",
    academicLevel: normalizeAcademicLevel(mergedProfile.qualification || mergedProfile.academicLevel || ""),
    fieldOfStudy: mergedProfile.fieldOfStudy || "",
    academicGoal: mergedProfile.academicGoal || "",
    studyStyle: mergedProfile.learningStyle || mergedProfile.studyStyle || "",
    studyHoursPerDay: String(mergedProfile.studyHours || mergedProfile.studyHoursPerDay || ""),
    studyDaysPerWeek: String(mergedProfile.studyDaysPerWeek || ""),
    preferredStudyTime: mergedProfile.productiveTime || mergedProfile.preferredStudyTime || "",
    studyChallenges: mergedProfile.studyChallenges || [],
  });

  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);
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
    const level = normalizeAcademicLevel(
      mergedProfile?.academicLevel || mergedProfile?.qualification || profile?.academicLevel || ""
    );
    return academicLevelMap[level] || "Student";
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

  const selectedAvatarId = mergedProfile?.selectedAvatar || "default";
  const selectedAvatar = AVATAR_OPTIONS.find((avatar) => avatar.id === selectedAvatarId) || AVATAR_OPTIONS[0];

  const handleAvatarSelect = async (avatarId: string) => {
    const nextProfile = {
      ...(profile || userProf),
      selectedAvatar: avatarId,
    };

    setProfile(nextProfile);
    await updateUser({ profile: nextProfile });
    setAvatarPickerVisible(false);
  };

  const handleSave = async () => {
    try {
      await updateUser({
        firstName: editedProfile.firstName,
        lastName: editedProfile.lastName,
      });

      const profileData: any = {
        ...(profile || userProf),
        academicLevel: normalizeAcademicLevel(editedProfile.academicLevel),
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
      academicLevel: normalizeAcademicLevel(
        mergedProfile?.qualification || mergedProfile?.academicLevel || profile?.academicLevel || ""
      ),
      fieldOfStudy: mergedProfile?.fieldOfStudy || profile?.fieldOfStudy || "",
      academicGoal: mergedProfile?.academicGoal || profile?.academicGoal || "",
      studyStyle: mergedProfile?.studyStyle || mergedProfile?.learningStyle || profile?.studyStyle || "",
      studyHoursPerDay: String(mergedProfile?.studyHoursPerDay || mergedProfile?.studyHours || profile?.studyHoursPerDay || ""),
      studyDaysPerWeek: String(mergedProfile?.studyDaysPerWeek || profile?.studyDaysPerWeek || ""),
      preferredStudyTime: mergedProfile?.preferredStudyTime || mergedProfile?.productiveTime || profile?.preferredStudyTime || "",
      studyChallenges: mergedProfile?.studyChallenges || profile?.studyChallenges || [],
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
    const hasValue = value !== undefined && value !== null && value !== "";
    let displayValue = hasValue ? value : "Not set";
    if (field && displayMaps[field]) {
      const normalizedValue = field === "academicLevel" ? normalizeAcademicLevel(value) : value;
      displayValue = hasValue ? displayMaps[field][normalizedValue] || normalizedValue : "Not set";
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
              <Ionicons name={icon as any} size={18} color="#113e17ff" />
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

  const moduleReports = modules.map((module) => {
    const moduleAssessments = assessments.filter(
      (assessment) => assessment.moduleId === module.id,
    );

    const scoredAssessments = moduleAssessments.filter(
      (assessment) => typeof assessment.score === "number",
    );

    const completedAssessments = moduleAssessments.filter(
      (assessment) => assessment.completed,
    );

    const averageScore = scoredAssessments.length
      ? Math.round(
          scoredAssessments.reduce(
            (sum, assessment) => sum + (assessment.score ?? 0),
            0,
          ) / scoredAssessments.length,
        )
      : 0;

    const progress = moduleAssessments.length
      ? Math.min(
          100,
          Math.round(
            (completedAssessments.length / moduleAssessments.length) * 100,
          ),
        )
      : 0;

    return {
      module,
      progress,
      averageScore,
      assessments: moduleAssessments,
      completedAssessments: completedAssessments.length,
    };
  });

  const studyPoints = typeof profile?.studyPoints === "number"
    ? profile.studyPoints
    : typeof mergedProfile?.studyPoints === "number"
      ? mergedProfile.studyPoints
      : 1000;
  const studyTier = getStudyTier(studyPoints);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header with Gradient */}
        <LinearGradient
          colors={["#079900ff", "#21632aff"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHeader}
        >
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => setAvatarPickerVisible(true)}
            activeOpacity={0.85}
          >
            {selectedAvatar.emoji ? (
              <Text style={styles.avatarEmoji}>{selectedAvatar.emoji}</Text>
            ) : (
              <Ionicons name="person" size={50} color="white" />
            )}
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={13} color="#123d1a" />
            </View>
          </TouchableOpacity>
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
              <Ionicons name="create-outline" size={18} color="#11421cff" />
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        {/* Study points */}
        <View style={styles.pointsCard}>
          <View style={styles.pointsArtworkWrap}>
            <MetallicStudyBadge tier={studyTier} />
          </View>
          <View style={styles.pointsInfo}>
            <Text style={styles.pointsEyebrow}>STUDY RANK</Text>
            <Text style={styles.pointsTier}>{studyTier.label}</Text>
            <View style={styles.pointsValueRow}>
              <Text style={styles.pointsValue}>{studyPoints}</Text>
              <Text style={styles.pointsUnit}> points</Text>
            </View>
            <Text style={styles.pointsHint}>
              {studyPoints <= 100
                ? "Your points are critically low. Attend sessions to avoid account action."
                : "Keep your scheduled sessions attended to protect your points."}
            </Text>
          </View>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={20} color="#185a22ff" />
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

        {/* Study Reports */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bar-chart-outline" size={20} color="#0e3a2c" />
            <Text style={styles.sectionTitle}>Study Reports</Text>
          </View>
          <View style={styles.sectionContent}>
            {moduleReports.length === 0 ? (
              <View style={styles.emptyReportState}>
                <Ionicons name="document-outline" size={36} color="#d1d5db" />
                <Text style={styles.emptyReportText}>
                  No modules yet. Add a module and complete study activities to see your progress here.
                </Text>
              </View>
            ) : (
              moduleReports.map(({ module, progress, averageScore, completedAssessments }) => (
                <View key={module.id} style={styles.reportItem}>
                  <View style={styles.reportHeaderRow}>
                    <View style={styles.reportTitleWrap}>
                      <View
                        style={[
                          styles.reportIcon,
                          { backgroundColor: `${module.color}22` },
                        ]}
                      >
                        <Ionicons
                          name={(module.icon || "book-outline") as any}
                          size={18}
                          color={module.color}
                        />
                      </View>
                      <View style={styles.reportTextWrap}>
                        <Text style={styles.reportTitle}>{module.name}</Text>
                        <Text style={styles.reportMetaText}>
                          {completedAssessments} assessment
                          {completedAssessments === 1 ? "" : "s"} completed
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.reportScoreText}>{averageScore}%</Text>
                  </View>

                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.max(progress, 8)}%`, backgroundColor: module.color },
                      ]}
                    />
                  </View>

                  <View style={styles.reportFooterRow}>
                    <Text style={styles.reportFooterText}>Progress</Text>
                    <Text style={styles.reportFooterValue}>{progress}%</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Academic Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="library-outline" size={20} color="#155017ff" />
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
                  mergedProfile?.academicLevel || mergedProfile?.qualification || profile?.academicLevel,
                  "academicLevel",
                  "school-outline",
                )}
                {renderViewField(
                  "Field of Study",
                  mergedProfile?.fieldOfStudy || profile?.fieldOfStudy,
                  "fieldOfStudy",
                  "book-outline",
                )}
                {renderViewField(
                  "Academic Goal",
                  mergedProfile?.academicGoal || profile?.academicGoal,
                  "academicGoal",
                  "flag-outline",
                )}
                {renderViewField(
                  "Study Style",
                  mergedProfile?.studyStyle || mergedProfile?.learningStyle || profile?.studyStyle,
                  "studyStyle",
                  "bulb-outline",
                )}
                {renderViewField(
                  "Study Hours/Day",
                  mergedProfile?.studyHoursPerDay || mergedProfile?.studyHours || profile?.studyHoursPerDay,
                  undefined,
                  "time-outline",
                )}
                {renderViewField(
                  "Study Days/Week",
                  mergedProfile?.studyDaysPerWeek || profile?.studyDaysPerWeek,
                  undefined,
                  "calendar-outline",
                )}
                {renderViewField(
                  "Preferred Study Time",
                  mergedProfile?.preferredStudyTime || mergedProfile?.productiveTime || profile?.preferredStudyTime,
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
                        color="#1d3c19ff"
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

      <Modal
        visible={avatarPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAvatarPickerVisible(false)}
      >
        <View style={styles.avatarModalOverlay}>
          <View style={styles.avatarModalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Choose your avatar</Text>
                <Text style={styles.avatarModalSubtitle}>Your default avatar is always available.</Text>
              </View>
              <TouchableOpacity onPress={() => setAvatarPickerVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={AVATAR_OPTIONS}
              numColumns={4}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.avatarGrid}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedAvatarId;
                return (
                  <TouchableOpacity
                    style={styles.avatarOption}
                    onPress={() => void handleAvatarSelect(item.id)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.avatarOptionCircle,
                        { backgroundColor: item.color },
                        isSelected && styles.avatarOptionSelected,
                      ]}
                    >
                      {item.emoji ? (
                        <Text style={styles.avatarOptionEmoji}>{item.emoji}</Text>
                      ) : (
                        <Ionicons name="person" size={30} color="#ffffff" />
                      )}
                      {isSelected && (
                        <View style={styles.avatarCheckBadge}>
                          <Ionicons name="checkmark" size={12} color="#ffffff" />
                        </View>
                      )}
                    </View>
                    <Text style={styles.avatarOptionLabel}>{item.label}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
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
  avatarEmoji: {
    fontSize: 52,
  },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#21632a",
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
    color: "#1b461aff",
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
  pointsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10251f",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  pointsArtworkWrap: {
    width: 108,
    height: 108,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  badgeArtwork: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeOrbit: {
    position: "absolute",
    width: 92,
    height: 58,
    borderWidth: 2,
    borderRadius: 46,
    opacity: 0.9,
  },
  badgeSpark: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  badgeSparkTop: {
    top: -3,
    left: 44,
  },
  badgeSparkBottom: {
    bottom: -3,
    right: 15,
  },
  metalBadge: {
    width: 74,
    height: 74,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.78)",
    overflow: "hidden",
    shadowColor: "#fef3c7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 8,
  },
  badgeInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  badgeCrown: {
    position: "absolute",
    top: 3,
    zIndex: 2,
  },
  badgeStar: {
    position: "absolute",
    zIndex: 2,
    top: 22,
  },
  badgeRibbon: {
    position: "absolute",
    opacity: 0.55,
    top: 17,
  },
  badgeShine: {
    position: "absolute",
    width: 18,
    height: 140,
    backgroundColor: "rgba(255,255,255,0.58)",
  },
  pointsInfo: {
    flex: 1,
  },
  pointsEyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: "#b7c9bf",
    fontWeight: "700",
  },
  pointsTier: {
    marginTop: 2,
    fontSize: 24,
    color: "#ffffff",
    fontWeight: "800",
  },
  pointsValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 3,
  },
  pointsValue: {
    fontSize: 20,
    color: "#fef3c7",
    fontWeight: "800",
  },
  pointsUnit: {
    fontSize: 13,
    color: "#d1d5db",
  },
  pointsHint: {
    marginTop: 7,
    fontSize: 11,
    lineHeight: 16,
    color: "#b7c9bf",
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
  emptyReportState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  emptyReportText: {
    marginTop: 12,
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
  reportItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  reportHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  reportTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  reportIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  reportTextWrap: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "600",
  },
  reportMetaText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  reportScoreText: {
    fontSize: 14,
    color: "#0f766e",
    fontWeight: "700",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  reportFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  reportFooterText: {
    fontSize: 12,
    color: "#6b7280",
  },
  reportFooterValue: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "600",
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
    backgroundColor: "#0e320dff",
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
  avatarModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(5, 15, 10, 0.62)",
    justifyContent: "flex-end",
  },
  avatarModalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    minHeight: 360,
    maxHeight: "72%",
  },
  avatarModalSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#6b7280",
  },
  avatarGrid: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 28,
  },
  avatarOption: {
    width: "25%",
    alignItems: "center",
    paddingVertical: 10,
  },
  avatarOptionCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.8)",
    shadowColor: "#123d1a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  avatarOptionSelected: {
    borderColor: "#166534",
    transform: [{ scale: 1.08 }],
  },
  avatarOptionEmoji: {
    fontSize: 34,
  },
  avatarCheckBadge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 21,
    height: 21,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#166534",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  avatarOptionLabel: {
    marginTop: 6,
    fontSize: 11,
    color: "#374151",
    textAlign: "center",
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
