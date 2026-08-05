import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CustomButton } from "../components/CustomButton";
import { CustomCard } from "../components/CustomCard";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";

const TOTAL_STEPS = 10;

export function OnboardingScreen() {
  const navigation = useNavigation();
  const { setProfile } = useStore();
  const { completeOnboarding } = useAuth();
  const [step, setStep] = useState(1);
  const [profile, setProfileState] = useState({
    qualification: undefined as string | undefined,
    year: undefined as string | undefined,
    academicGoal: undefined as string | undefined,
    learningStyle: undefined as string | undefined,
    studyChallenges: [] as string[],
    studyHours: undefined as string | undefined,
    productiveTime: undefined as string | undefined,
    reminderFrequency: undefined as string | undefined,
    aiSupport: undefined as string | undefined,
    resourceRecommendations: undefined as string | undefined,
  });

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    setProfile(profile as any);
    await completeOnboarding();
    Alert.alert("Success", "Profile completed! Welcome to Study Mate!");
    (navigation.navigate as any)("Main");
  };

  const toggleChallenge = (challenge: string) => {
    const currentChallenges = profile.studyChallenges || [];
    if (currentChallenges.includes(challenge)) {
      setProfileState({
        ...profile,
        studyChallenges: currentChallenges.filter((c) => c !== challenge),
      });
    } else {
      setProfileState({
        ...profile,
        studyChallenges: [...currentChallenges, challenge],
      });
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return profile.qualification !== undefined;
      case 2:
        return profile.year !== undefined;
      case 3:
        return profile.academicGoal !== undefined;
      case 4:
        return profile.learningStyle !== undefined;
      case 5:
        return (profile.studyChallenges || []).length >= 2;
      case 6:
        return profile.studyHours !== undefined;
      case 7:
        return profile.productiveTime !== undefined;
      case 8:
        return profile.reminderFrequency !== undefined;
      case 9:
        return profile.aiSupport !== undefined;
      case 10:
        return profile.resourceRecommendations !== undefined;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionText}>
              What qualification are you studying?
            </Text>
            <View style={styles.optionsList}>
              {[
                { value: "bachelor", label: "Bachelor's Degree" },
                { value: "master", label: "Master's Degree" },
                { value: "phd", label: "PhD" },
                { value: "diploma", label: "Diploma" },
                { value: "certificate", label: "Certificate" },
                { value: "high-school", label: "High School" },
                { value: "other", label: "Other" },
              ].map((qual) => (
                <TouchableOpacity
                  key={qual.value}
                  style={[
                    styles.listOption,
                    profile.qualification === qual.value &&
                      styles.optionSelected,
                  ]}
                  onPress={() =>
                    setProfileState({ ...profile, qualification: qual.value })
                  }
                >
                  <Text
                    style={[
                      styles.optionText,
                      profile.qualification === qual.value &&
                        styles.optionTextSelected,
                    ]}
                  >
                    {qual.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionText}>
              What year are you currently in?
            </Text>
            <View style={styles.optionsList}>
              {[
                { value: "first", label: "First Year" },
                { value: "second", label: "Second Year" },
                { value: "third", label: "Third Year" },
                { value: "fourth", label: "Fourth Year" },
                { value: "postgraduate", label: "Postgraduate" },
              ].map((year) => (
                <TouchableOpacity
                  key={year.value}
                  style={[
                    styles.listOption,
                    profile.year === year.value && styles.optionSelected,
                  ]}
                  onPress={() =>
                    setProfileState({ ...profile, year: year.value })
                  }
                >
                  <Text
                    style={[
                      styles.optionText,
                      profile.year === year.value && styles.optionTextSelected,
                    ]}
                  >
                    {year.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionText}>
              What is your academic goal this semester?
            </Text>
            <View style={styles.optionsList}>
              {[
                { value: "pass", label: "Pass all my modules" },
                { value: "improve", label: "Improve my grades" },
                { value: "distinctions", label: "Achieve distinctions" },
                { value: "graduate", label: "Graduate this year" },
              ].map((goal) => (
                <TouchableOpacity
                  key={goal.value}
                  style={[
                    styles.listOption,
                    profile.academicGoal === goal.value &&
                      styles.optionSelected,
                  ]}
                  onPress={() =>
                    setProfileState({ ...profile, academicGoal: goal.value })
                  }
                >
                  <Text
                    style={[
                      styles.optionText,
                      profile.academicGoal === goal.value &&
                        styles.optionTextSelected,
                    ]}
                  >
                    {goal.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionText}>How do you learn best?</Text>
            <View style={styles.optionsList}>
              {[
                { value: "reading", label: "Reading notes", icon: "book" },
                { value: "videos", label: "Watching videos", icon: "videocam" },
                {
                  value: "practice",
                  label: "Practice questions",
                  icon: "fitness",
                },
                {
                  value: "combination",
                  label: "A combination of all",
                  icon: "sync",
                },
              ].map((style) => (
                <TouchableOpacity
                  key={style.value}
                  style={[
                    styles.listOption,
                    profile.learningStyle === style.value &&
                      styles.optionSelected,
                  ]}
                  onPress={() =>
                    setProfileState({ ...profile, learningStyle: style.value })
                  }
                >
                  <Ionicons
                    name={style.icon as any}
                    size={24}
                    color={
                      profile.learningStyle === style.value
                        ? "#6366f1"
                        : "#9ca3af"
                    }
                  />
                  <Text
                    style={[
                      styles.optionText,
                      profile.learningStyle === style.value &&
                        styles.optionTextSelected,
                      { marginLeft: 12, flex: 1 },
                    ]}
                  >
                    {style.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionText}>
              What is your biggest study challenge? (Select 2 or more)
            </Text>
            <Text style={styles.subtext}>Select at least 2 options</Text>
            <View style={styles.optionsList}>
              {[
                {
                  value: "time-management",
                  label: "Time management",
                  icon: "time",
                },
                {
                  value: "understanding",
                  label: "Understanding difficult concepts",
                  icon: "bulb",
                },
                {
                  value: "remembering",
                  label: "Remembering information",
                  icon: "brain",
                },
                {
                  value: "motivation",
                  label: "Staying motivated",
                  icon: "flame",
                },
                {
                  value: "exam-anxiety",
                  label: "Exam anxiety",
                  icon: "alert-circle",
                },
              ].map((challenge) => {
                const isSelected = (profile.studyChallenges || []).includes(
                  challenge.value,
                );
                return (
                  <TouchableOpacity
                    key={challenge.value}
                    style={[
                      styles.listOption,
                      isSelected && styles.optionSelected,
                    ]}
                    onPress={() => toggleChallenge(challenge.value)}
                  >
                    <Ionicons
                      name={challenge.icon as any}
                      size={24}
                      color={isSelected ? "#6366f1" : "#9ca3af"}
                    />
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected,
                        { marginLeft: 12, flex: 1 },
                      ]}
                    >
                      {challenge.label}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color="#6366f1"
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionText}>
              How many hours can you realistically study each day?
            </Text>
            <View style={styles.optionsList}>
              {[
                { value: "less-than-1", label: "Less than 1 hour" },
                { value: "1-2", label: "1–2 hours" },
                { value: "2-4", label: "2–4 hours" },
                { value: "more-than-4", label: "More than 4 hours" },
              ].map((hours) => (
                <TouchableOpacity
                  key={hours.value}
                  style={[
                    styles.listOption,
                    profile.studyHours === hours.value && styles.optionSelected,
                  ]}
                  onPress={() =>
                    setProfileState({ ...profile, studyHours: hours.value })
                  }
                >
                  <Text
                    style={[
                      styles.optionText,
                      profile.studyHours === hours.value &&
                        styles.optionTextSelected,
                    ]}
                  >
                    {hours.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 7:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionText}>
              When are you usually most productive?
            </Text>
            <View style={styles.optionsList}>
              {[
                {
                  value: "morning",
                  label: "Morning (6 AM - 12 PM)",
                  icon: "sunny",
                },
                {
                  value: "afternoon",
                  label: "Afternoon (12 PM - 4 PM)",
                  icon: "sunny-outline",
                },
                {
                  value: "evening",
                  label: "Evening (4 PM - 9 PM)",
                  icon: "moon",
                },
                {
                  value: "late-night",
                  label: "Late night (9 PM - 2 AM)",
                  icon: "moon-outline",
                },
              ].map((time) => (
                <TouchableOpacity
                  key={time.value}
                  style={[
                    styles.listOption,
                    profile.productiveTime === time.value &&
                      styles.optionSelected,
                  ]}
                  onPress={() =>
                    setProfileState({ ...profile, productiveTime: time.value })
                  }
                >
                  <Ionicons
                    name={time.icon as any}
                    size={24}
                    color={
                      profile.productiveTime === time.value
                        ? "#6366f1"
                        : "#9ca3af"
                    }
                  />
                  <Text
                    style={[
                      styles.optionText,
                      profile.productiveTime === time.value &&
                        styles.optionTextSelected,
                      { marginLeft: 12 },
                    ]}
                  >
                    {time.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 8:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionText}>
              How often would you like Study Mate to remind you to study?
            </Text>
            <View style={styles.optionsList}>
              {[
                { value: "every-day", label: "Every day" },
                { value: "every-two-days", label: "Every two days" },
                { value: "twice-week", label: "Twice a week" },
                { value: "once-week", label: "Once a week" },
                {
                  value: "before-assessments",
                  label: "Only before assessments",
                },
              ].map((freq) => (
                <TouchableOpacity
                  key={freq.value}
                  style={[
                    styles.listOption,
                    profile.reminderFrequency === freq.value &&
                      styles.optionSelected,
                  ]}
                  onPress={() =>
                    setProfileState({
                      ...profile,
                      reminderFrequency: freq.value,
                    })
                  }
                >
                  <Text
                    style={[
                      styles.optionText,
                      profile.reminderFrequency === freq.value &&
                        styles.optionTextSelected,
                    ]}
                  >
                    {freq.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 9:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionText}>
              What type of support would you like from the AI?
            </Text>
            <View style={styles.optionsList}>
              {[
                {
                  value: "explain",
                  label: "Explain difficult concepts",
                  icon: "school",
                },
                {
                  value: "summarize",
                  label: "Summarize notes",
                  icon: "document-text",
                },
                {
                  value: "quizzes",
                  label: "Generate quizzes",
                  icon: "help-circle",
                },
                {
                  value: "study-plans",
                  label: "Recommend study plans",
                  icon: "calendar",
                },
                { value: "all", label: "All of the above", icon: "apps" },
              ].map((support) => (
                <TouchableOpacity
                  key={support.value}
                  style={[
                    styles.listOption,
                    profile.aiSupport === support.value &&
                      styles.optionSelected,
                  ]}
                  onPress={() =>
                    setProfileState({ ...profile, aiSupport: support.value })
                  }
                >
                  <Ionicons
                    name={support.icon as any}
                    size={24}
                    color={
                      profile.aiSupport === support.value
                        ? "#6366f1"
                        : "#9ca3af"
                    }
                  />
                  <Text
                    style={[
                      styles.optionText,
                      profile.aiSupport === support.value &&
                        styles.optionTextSelected,
                      { marginLeft: 12, flex: 1 },
                    ]}
                  >
                    {support.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 10:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionText}>
              Would you like Study Mate to recommend learning resources such as
              YouTube videos when you need extra help?
            </Text>
            <View style={styles.optionsList}>
              {[
                { value: "yes", label: "Yes", icon: "checkmark-circle" },
                { value: "no", label: "No", icon: "close-circle" },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.listOption,
                    profile.resourceRecommendations === option.value &&
                      styles.optionSelected,
                  ]}
                  onPress={() =>
                    setProfileState({
                      ...profile,
                      resourceRecommendations: option.value,
                    })
                  }
                >
                  <Ionicons
                    name={option.icon as any}
                    size={24}
                    color={
                      profile.resourceRecommendations === option.value
                        ? "#6366f1"
                        : "#9ca3af"
                    }
                  />
                  <Text
                    style={[
                      styles.optionText,
                      profile.resourceRecommendations === option.value &&
                        styles.optionTextSelected,
                      { marginLeft: 12 },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <LinearGradient colors={["#eef2ff", "#fae8ff"]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <CustomCard style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="school" size={40} color="white" />
          </View>

          <Text style={styles.title}>{"Let's Get to Know You"}</Text>
          <Text style={styles.subtitle}>
            Help us personalize your study experience
          </Text>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>
              Step {step} of {TOTAL_STEPS}
            </Text>
          </View>

          {renderStepContent()}

          <View style={styles.navigationButtons}>
            <CustomButton
              title="Back"
              variant="outline"
              onPress={handleBack}
              disabled={step === 1}
              style={styles.navButton}
            />
            <CustomButton
              title={step === TOTAL_STEPS ? "Complete" : "Next"}
              onPress={handleNext}
              disabled={!canProceed()}
              style={styles.navButton}
            />
          </View>
        </CustomCard>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 16,
  },
  card: {
    padding: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#6366f1",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
  },
  stepContainer: {
    minHeight: 300,
  },
  questionText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
    fontStyle: "italic",
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  optionsList: {
    gap: 12,
  },
  optionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
  },
  listOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
  },
  optionSelected: {
    borderColor: "#6366f1",
    backgroundColor: "#eef2ff",
  },
  optionText: {
    fontSize: 16,
    color: "#374151",
  },
  optionTextSelected: {
    color: "#6366f1",
    fontWeight: "500",
  },
  navigationButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  navButton: {
    flex: 1,
  },
});
