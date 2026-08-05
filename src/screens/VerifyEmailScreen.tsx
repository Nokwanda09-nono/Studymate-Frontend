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

type RootStackParamList = {
  Login: undefined;
  VerifyEmail: {
    email: string;
  };
};
export function VerifyEmailScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "VerifyEmail">>();

  const { email } = route.params;

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const API_URL = "https://study-mate-v1-ten.vercel.app/api";

  const handleVerify = async () => {
    if (code.length !== 6) {
      Alert.alert(
        "Invalid Code",
        "Please enter the 6-digit verification code.",
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/verify-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          code,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert("Success", "Your email has been verified successfully.", [
          {
            text: "Login",
            onPress: () =>
              navigation.reset({
                index: 0,
                routes: [{ name: "Login" }],
              }),
          },
        ]);
      } else {
        Alert.alert("Verification Failed", data.error);
      }
    } catch (error) {
      Alert.alert("Error", "Unable to connect to the server.");
    }

    setLoading(false);
  };

  const handleResendVerification = async () => {
    setResendLoading(true);

    try {
      const response = await fetch(`${API_URL}/resend-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          "Verification Code Sent",
          "A new verification code has been sent to your email.",
        );
      } else {
        Alert.alert("Error", data.error);
      }
    } catch (error) {
      Alert.alert("Error", "Unable to connect to the server.");
    }

    setResendLoading(false);
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
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={handleResendVerification}
          disabled={resendLoading}
        >
          {resendLoading ? (
            <ActivityIndicator color="#4c669f" />
          ) : (
            <Text style={styles.linkText}>Resend Code</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate("Login")}
        >
          <Ionicons name="arrow-back" size={20} color="#4c669f" />
          <Text style={styles.backText}>Back to Login</Text>
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
    marginBottom: 24,
    textAlign: "center",
  },
  input: {
    width: "100%",
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#fff",
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
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
