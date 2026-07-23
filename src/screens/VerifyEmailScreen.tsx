import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type RootStackParamList = {
  Login: undefined;
  VerifyEmail: { email?: string; token?: string };
};

export function VerifyEmailScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'VerifyEmail'>>();
  const { email, token } = route.params || {};
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');

  // Handle deep link token
  useEffect(() => {
    const handleDeepLink = async () => {
      // If token came from route params (from deep link)
      if (token) {
        await handleVerify(token);
        return;
      }

      // Check if app was opened from a deep link
      const url = await Linking.getInitialURL();
      if (url) {
        const parsedUrl = Linking.parse(url);
        const path = parsedUrl.path;
        const queryParams = parsedUrl.queryParams;
        
        if (path === 'verify-email' && queryParams?.token) {
          const token = Array.isArray(queryParams.token) ? queryParams.token[0] : queryParams.token;
          await handleVerify(token);
        }
      }
    };

    handleDeepLink();

    // Listen for deep link events while app is running
    const subscription = Linking.addEventListener('url', async ({ url }) => {
      const parsedUrl = Linking.parse(url);
      const path = parsedUrl.path;
      const queryParams = parsedUrl.queryParams;
      
      if (path === 'verify-email' && queryParams?.token) {
        const token = Array.isArray(queryParams.token) ? queryParams.token[0] : queryParams.token;
        await handleVerify(token);
      }
    });

    return () => subscription.remove();
  }, []);

  const handleVerify = async (verificationToken: string) => {
    if (!verificationToken) {
      Alert.alert('Error', 'Invalid verification token');
      return;
    }

    setVerificationStatus('verifying');
    try {
      const response = await fetch(`http://localhost:5000/api/verify-email?token=${verificationToken}`);
      const data = await response.json();

      if (response.ok) {
        setVerificationStatus('success');
        // Show success message
        Alert.alert(
          '✅ Email Verified!',
          'Your email has been successfully verified. You can now log in.',
          [
            {
              text: 'Go to Login',
              onPress: () => navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              }),
            },
          ]
        );
      } else {
        setVerificationStatus('error');
        Alert.alert(
          'Verification Failed',
          data.error || 'Failed to verify email. Please try again.',
          [
            {
              text: 'Try Again',
              onPress: () => setVerificationStatus('idle'),
            },
          ]
        );
      }
    } catch (error) {
      setVerificationStatus('error');
      Alert.alert(
        'Error',
        'Failed to connect to server. Please check your internet connection.'
      );
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      Alert.alert('Error', 'Email not found. Please go back and register again.');
      return;
    }

    setResendLoading(true);
    try {
      // Use your computer's IP address instead of localhost for mobile
      const API_URL = 'http://192.168.1.x:5000/api'; // Replace with your IP
      const response = await fetch(`${API_URL}/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          'Success',
          'Verification email has been resent. Please check your inbox and spam folder.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', data.error || 'Failed to resend verification email');
      }
    } catch (error) {
      console.error('Resend error:', error);
      Alert.alert('Error', 'Failed to connect to server. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#eef2ff', '#fae8ff']} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {verificationStatus === 'verifying' ? (
            <ActivityIndicator size="large" color="#6366f1" />
          ) : verificationStatus === 'success' ? (
            <Ionicons name="checkmark-circle" size={60} color="#22c55e" />
          ) : verificationStatus === 'error' ? (
            <Ionicons name="close-circle" size={60} color="#ef4444" />
          ) : (
            <Ionicons name="mail" size={60} color="#6366f1" />
          )}
        </View>

        {verificationStatus === 'verifying' ? (
          <>
            <Text style={styles.title}>Verifying Your Email</Text>
            <Text style={styles.subtitle}>Please wait while we verify your email address...</Text>
          </>
        ) : verificationStatus === 'success' ? (
          <>
            <Text style={styles.title}>Email Verified! 🎉</Text>
            <Text style={styles.subtitle}>Your email has been successfully verified.</Text>
          </>
        ) : verificationStatus === 'error' ? (
          <>
            <Text style={styles.title}>Verification Failed</Text>
            <Text style={styles.subtitle}>Unable to verify your email. Please try again.</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Verify Your Email</Text>
            <Text style={styles.subtitle}>
              We've sent a verification link to:
            </Text>
            <Text style={styles.email}>{email || 'your email address'}</Text>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={24} color="#6366f1" />
              <Text style={styles.infoText}>
                Please check your email and click the verification link to activate your account. 
                The link will open the app automatically.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResendVerification}
              disabled={resendLoading}
            >
              {resendLoading ? (
                <ActivityIndicator color="#6366f1" />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={20} color="#6366f1" />
                  <Text style={styles.resendText}>Resend Verification Email</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.manualButton}
              onPress={() => {
                Alert.alert(
                  'Manual Verification',
                  'If the link isn\'t working, you can enter the verification code manually.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Enter Code',
                      onPress: () => {
                        // You can add a manual code input here
                        Alert.alert('Manual Code', 'Enter the code from your email');
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={styles.manualText}>Having trouble? Click here</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => {
            if (verificationStatus === 'success') {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } else {
              navigation.navigate('Login');
            }
          }}
        >
          <Text style={styles.loginButtonText}>
            {verificationStatus === 'success' ? 'Go to Login' : 'Back to Login'}
          </Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 24,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eef2ff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    color: '#4b5563',
    marginLeft: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
  },
  resendText: {
    color: '#6366f1',
    fontWeight: '600',
    marginLeft: 8,
  },
  manualButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  manualText: {
    color: '#6b7280',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  loginButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  loginButtonText: {
    color: '#6b7280',
    fontSize: 16,
  },
});