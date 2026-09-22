import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { CustomButton } from '../components/CustomButton';
import { useAuth } from '../context/AuthContext';

type RootStackParamList = {
  Register: undefined;
  VerifyEmail: { email: string };
  Onboarding: undefined;
  Main: undefined;
};

export function LoginScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { login, resendVerification, forgotPassword, user, loading: authLoading } = useAuth();
  const { width, height } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const isSmallDevice = width < 360 || height < 700;

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      
      // After successful login, the useEffect will handle navigation
      // based on onboarding status
    } catch (error: any) {
      // Check if the error is due to unverified email
      if (error.requiresVerification || error.message?.includes('verify your email')) {
        Alert.alert(
          'Email Not Verified',
          'Please verify your email before logging in. Would you like to resend the verification email?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Resend Email',
              onPress: () => handleResendVerification(),
            },
          ]
        );
      } else {
        Alert.alert('Login Failed', error.message || 'Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address first');
      return;
    }

    setResendLoading(true);
    try {
      await resendVerification(email);
      
      Alert.alert(
        'Verification Email Sent',
        'A new verification link has been sent to your email. Please check your inbox and spam folder.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('VerifyEmail', { email }),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend verification email');
    } finally {
      setResendLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      Alert.alert('Email required', 'Please enter your email address first.');
      return;
    }

    setResetLoading(true);
    try {
      await forgotPassword(trimmedEmail);
      Alert.alert(
        'Reset link sent',
        'A password reset link has been sent to your email. Please check your inbox and spam folder.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Reset failed', error.message || 'Could not send a password reset link right now.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#eef2ff', '#fae8ff']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isSmallDevice && styles.scrollContentSmall,
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={[styles.card, isSmallDevice ? styles.cardSmall : styles.cardLarge]}>
            <View style={[styles.header, isSmallDevice && styles.headerSmall]}>
              <View style={[styles.iconContainer, isSmallDevice ? styles.iconContainerSmall : styles.iconContainerLarge]}>
                <Ionicons name="school" size={isSmallDevice ? 28 : 38} color="white" />
              </View>
              <Text style={[styles.title, isSmallDevice && styles.titleSmall]}>Welcome Back</Text>
              <Text style={[styles.subtitle, isSmallDevice && styles.subtitleSmall]}>
                Login to continue your study journey
              </Text>
            </View>

            <View style={[styles.form, isSmallDevice ? styles.formSmall : styles.formLarge]}>
              <View style={[styles.inputContainer, isSmallDevice && styles.inputContainerSmall]}>
                <Ionicons name="mail-outline" size={18} color="#9ca3af" />
                <TextInput
                  style={[styles.input, isSmallDevice && styles.inputSmall]}
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={[styles.inputContainer, isSmallDevice && styles.inputContainerSmall]}>
                <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" />
                <TextInput
                  style={[styles.input, { flex: 1 }, isSmallDevice && styles.inputSmall]}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#9ca3af"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.forgotPassword, isSmallDevice && styles.forgotPasswordSmall]}
                disabled={loading || resetLoading}
                onPress={handleForgotPassword}
              >
                <Text style={[styles.forgotPasswordText, isSmallDevice && styles.forgotPasswordTextSmall]}>
                  {resetLoading ? 'Sending reset link...' : 'Forgot password?'}
                </Text>
              </TouchableOpacity>

              <CustomButton
                title="Login"
                onPress={handleLogin}
                loading={loading}
                size="large"
                style={styles.loginButton}
              />

              {resendLoading && (
                <View style={styles.resendLoadingContainer}>
                  <ActivityIndicator size="small" color="#6366f1" />
                  <Text style={styles.resendLoadingText}>Sending verification email...</Text>
                </View>
              )}

              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.divider} />
              </View>

              <View style={[styles.registerContainer, isSmallDevice && styles.registerContainerSmall]}>
                <Text style={[styles.registerText, isSmallDevice && styles.registerTextSmall]}>Don't have an account? </Text>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('Register')}
                  disabled={loading}
                >
                  <Text style={[styles.registerLink, isSmallDevice && styles.registerLinkSmall]}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 520 : '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: Platform.OS === 'web' ? 24 : 16,
  },
  scrollContentSmall: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  card: {
    width: '92%',
    maxWidth: 520,
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardSmall: {
    width: '94%',
    borderRadius: 16,
    padding: 18,
    maxWidth: 430,
  },
  cardLarge: {
    width: '90%',
    maxWidth: 500,
    padding: 28,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerSmall: {
    marginBottom: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  iconContainerLarge: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  iconContainerSmall: {
    width: 62,
    height: 62,
    borderRadius: 31,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  titleSmall: {
    fontSize: 24,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  subtitleSmall: {
    fontSize: 14,
    lineHeight: 18,
  },
  form: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  formLarge: {
    padding: 22,
  },
  formSmall: {
    padding: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    backgroundColor: '#f9fafb',
    minHeight: 52,
  },
  inputContainerSmall: {
    paddingHorizontal: 12,
    marginBottom: 12,
    minHeight: 48,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 16,
    color: '#111827',
  },
  inputSmall: {
    paddingVertical: 12,
    fontSize: 15,
  },
  forgotPassword: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordSmall: {
    marginBottom: 18,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
  forgotPasswordTextSmall: {
    fontSize: 13,
  },
  loginButton: {
    marginBottom: 12,
  },
  resendLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  resendLoadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#6b7280',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#9ca3af',
    fontSize: 14,
  },
  quickRegisterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    marginBottom: 16,
  },
  quickRegisterText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '500',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingTop: 4,
  },
  registerContainerSmall: {
    gap: 2,
  },
  registerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  registerTextSmall: {
    fontSize: 13,
  },
  registerLink: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  registerLinkSmall: {
    fontSize: 13,
  },
});