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
  const { login, resendVerification, forgotPassword } = useAuth();
  const { width, height } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isSmallDevice = width < 360 || height < 700;

  const handleLogin = async () => {
    setErrorMessage('');
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      await login(normalizedEmail, password);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unable to log in right now.';
      setErrorMessage(message);

      const requiresVerification =
        typeof error === 'object' &&
        error !== null &&
        'requiresVerification' in error &&
        error.requiresVerification === true;

      if (requiresVerification || /verify your email/i.test(message)) {
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined' && window.confirm('Your email address is not verified. Would you like to open the verification screen now?')) {
            navigation.navigate('VerifyEmail', { email: normalizedEmail });
          }
        } else {
          Alert.alert(
            'Email Not Verified',
            'Please verify your email before logging in.',
            [
              {
                text: 'Verify Now',
                onPress: () => navigation.navigate('VerifyEmail', { email: normalizedEmail }),
              },
              {
                text: 'Resend & Verify',
                onPress: () => handleResendVerification(true),
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async (openVerification = false) => {
    if (!email) {
      setErrorMessage('Please enter your email address first.');
      return;
    }

    setResendLoading(true);
    try {
      await resendVerification(email);
      
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.alert('A new verification code has been sent to your email.');
        }
        if (openVerification) {
          navigation.navigate('VerifyEmail', { email: email.trim() });
        }
      } else {
        Alert.alert(
          'Verification Email Sent',
          'A new verification link has been sent to your email.',
          [
            {
              text: 'OK',
              onPress: () => {
                if (openVerification) {
                  navigation.navigate('VerifyEmail', { email: email.trim() });
                }
              },
            },
          ]
        );
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to resend verification email.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address first to reset your password.');
      return;
    }

    setResetLoading(true);
    try {
      await forgotPassword(trimmedEmail);
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.alert('A password reset link has been sent to your email.');
        }
      } else {
        Alert.alert(
          'Reset link sent',
          'A password reset link has been sent to your email.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not send a password reset link right now.');
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
              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={18} color="#ef4444" />
                  <Text style={styles.errorBannerText}>{errorMessage}</Text>
                </View>
              ) : null}

              <View style={[styles.inputContainer, isSmallDevice && styles.inputContainerSmall]}>
                <Ionicons name="mail-outline" size={18} color="#9ca3af" />
                <TextInput
                  style={[styles.input, isSmallDevice && styles.inputSmall]}
                  placeholder="Email"
                  value={email}
                  onChangeText={(text) => { setEmail(text); setErrorMessage(''); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                  placeholderTextColor="#9ca3af"
                  returnKeyType="next"
                />
              </View>

              <View style={[styles.inputContainer, isSmallDevice && styles.inputContainerSmall]}>
                <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" />
                <TextInput
                  style={[styles.input, { flex: 1 }, isSmallDevice && styles.inputSmall]}
                  placeholder="Password"
                  value={password}
                  onChangeText={(text) => { setPassword(text); setErrorMessage(''); }}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  placeholderTextColor="#9ca3af"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
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
                <Text style={[styles.registerText, isSmallDevice && styles.registerTextSmall]}>Don&apos;t have an account? </Text>
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
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerSmall: {
    marginBottom: 14,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconContainerSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 8,
  },
  iconContainerLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  titleSmall: {
    fontSize: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  subtitleSmall: {
    fontSize: 12,
  },
  form: {
    gap: 14,
  },
  formSmall: {
    gap: 10,
  },
  formLarge: {
    gap: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  errorBannerText: {
    flex: 1,
    color: '#dc2626',
    fontSize: 13,
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    gap: 8,
  },
  inputContainerSmall: {
    paddingHorizontal: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  inputSmall: {
    paddingVertical: 9,
    fontSize: 14,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordSmall: {
    marginTop: -2,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '500',
  },
  forgotPasswordTextSmall: {
    fontSize: 12,
  },
  loginButton: {
    marginTop: 4,
  },
  resendLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  resendLoadingText: {
    fontSize: 12,
    color: '#6366f1',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 12,
    color: '#9ca3af',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  registerContainerSmall: {
    marginTop: 2,
  },
  registerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  registerTextSmall: {
    fontSize: 12,
  },
  registerLink: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  registerLinkSmall: {
    fontSize: 12,
  },
});
