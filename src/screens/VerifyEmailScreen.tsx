import { Ionicons } from "@expo/vector-icons";
import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";

type RootStackParamList = {
  Login: undefined;
  VerifyEmail: {
    email: string;
  };
  Home: undefined;
  Onboarding: undefined;
};

export function VerifyEmailScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "VerifyEmail">>();
  const { verifyEmail, resendVerification } = useAuth();

  const email = route.params?.email || "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) {
      Alert.alert(
        "Invalid Code",
        "Please enter the 6-digit verification code."
      );
      return;
    }

    setLoading(true);

    try {
      const data = await verifyEmail(code, email);

      Alert.alert(
        "Success 🎉", 
        "Your email has been verified successfully!"
      );
    } catch (error: any) {
      Alert.alert("Verification Failed", error.message || "Unable to verify code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);

    try {
      await resendVerification(email);
      Alert.alert(
        "Verification Code Sent",
        "A new verification code has been sent to your email."
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Unable to send verification code.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#4c669f", "#3b5998", "#192f6a"]}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code sent to</Text>
        <Text style={styles.email}>{email}</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          keyboardType="numeric"
          maxLength={6}
          placeholder="Enter verification code"
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={styles.button}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#4c669f" />
          ) : (
            <Text style={styles.buttonText}>Verify & Continue</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={handleResendVerification}
          disabled={resendLoading}
        >
          {resendLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.linkText}>Resend Code</Text>
          )}
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  email: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
    marginBottom: 24,
    textAlign: "center",
  },
  input: {
    width: "100%",
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    color: "#fff",
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    fontSize: 18,
    textAlign: "center",
    letterSpacing: 4,
  },
  button: {
    width: "100%",
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  buttonText: {
    color: "#4c669f",
    fontWeight: "700",
    fontSize: 16,
  },
  linkButton: {
    paddingVertical: 12,
  },
  linkText: {
    color: "#fff",
    textDecorationLine: "underline",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  backText: {
    color: "#fff",
    marginLeft: 8,
  },
});
