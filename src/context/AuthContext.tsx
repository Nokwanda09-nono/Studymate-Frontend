import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from 'react-native';
import { API_URL as CONFIG_API_URL } from "../config/api";

const LOCAL_API_URL = Platform.OS === 'android'
  ? 'http://localhost:5000/api'
  : 'http://localhost:5000/api';

const API_URL = CONFIG_API_URL && CONFIG_API_URL !== 'https://study-mate-v1-ten.vercel.app/api'
  ? CONFIG_API_URL
  : LOCAL_API_URL;

// Define User type
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  onboardingCompleted?: boolean;
  profile?: OnboardingProfile | null;
}

export interface OnboardingProfile {
  qualification: string;
  year: string;
  fieldOfStudy?: string;
  academicGoal: string;
  learningStyle: string;
  studyChallenges: string[];
  studyHours: string;
  studyDaysPerWeek?: string | number;
  productiveTime: string;
  reminderFrequency: string;
  aiSupport: string;
  resourceRecommendations: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  register: (firstName: string, lastName: string, email: string, password: string) => Promise<any>;
  forgotPassword: (email: string) => Promise<any>;
  logout: () => Promise<void>;
  verifyEmail: (code: string, email?: string) => Promise<any>;
  resendVerification: (email: string) => Promise<any>;
  completeOnboarding: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  saveOnboardingProfile: (profileData: OnboardingProfile) => Promise<any>;
  getOnboardingProfile: () => Promise<OnboardingProfile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const parseJsonResponse = async (response: Response) => {
    const text = await response.text();

    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch {
      const cleanedText = text.replace(/\s+/g, ' ').trim();

      if (cleanedText.startsWith('<')) {
        throw new Error('The server returned an HTML page instead of JSON. Please check the backend URL or server status.');
      }

      throw new Error(cleanedText.slice(0, 200) || 'Unexpected server response');
    }
  };

  const mergeStoredUserData = async (incomingUser: Partial<User> | null | undefined): Promise<User | null> => {
    try {
      const storedUserData = await AsyncStorage.getItem('userData');
      const parsedStoredUser = storedUserData ? JSON.parse(storedUserData) : null;

      const persistedOnboarding = await AsyncStorage.getItem('onboardingCompleted');

      const mergedUser: User = {
        id: incomingUser?.id || parsedStoredUser?.id || 'user_' + Date.now(),
        email: incomingUser?.email || parsedStoredUser?.email || '',
        firstName: incomingUser?.firstName || parsedStoredUser?.firstName || '',
        lastName: incomingUser?.lastName || parsedStoredUser?.lastName || '',
        emailVerified: incomingUser?.emailVerified ?? parsedStoredUser?.emailVerified ?? true,
        onboardingCompleted: Boolean(
          incomingUser?.onboardingCompleted ??
          parsedStoredUser?.onboardingCompleted ??
          (persistedOnboarding === 'true' || false)
        ),
        profile: incomingUser?.profile || parsedStoredUser?.profile || null,
      };

      return mergedUser;
    } catch {
      if (!incomingUser) {
        return null;
      }

      return {
        id: incomingUser.id || 'user_' + Date.now(),
        email: incomingUser.email || '',
        firstName: incomingUser.firstName || '',
        lastName: incomingUser.lastName || '',
        emailVerified: incomingUser.emailVerified ?? true,
        onboardingCompleted: Boolean(incomingUser.onboardingCompleted),
        profile: incomingUser.profile || null,
      };
    }
  };

  // Load user from storage on app start
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const userData = await AsyncStorage.getItem('userData');
        
        if (token && userData) {
          const storedUser = JSON.parse(userData);
          setAuthToken(token);
          setUser(storedUser);
        } else {
          const onboardingDone = await AsyncStorage.getItem('onboardingCompleted');
          const onboardingProfile = await AsyncStorage.getItem('onboardingProfile');
          if (onboardingDone === 'true' && onboardingProfile) {
            const savedProfile = JSON.parse(onboardingProfile);
            const restoredUser = {
              id: 'local-user',
              email: '',
              firstName: '',
              lastName: '',
              emailVerified: true,
              onboardingCompleted: true,
              profile: savedProfile,
            };
            setUser(restoredUser);
          }
        }
      } catch (error) {
        console.error('Error loading auth data:', error);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  // Helper function to make authenticated requests
  const authenticatedFetch = async (endpoint: string, options: RequestInit = {}) => {
    const token = await AsyncStorage.getItem('authToken');
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    let data;

    try {
      data = await parseJsonResponse(response);
    } catch (error) {
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      throw error;
    }

    if (!response.ok) {
      const errorMessage = data.error || data.message || 'Request failed';
      throw new Error(errorMessage);
    }

    return data;
  };

  // Login function
  const login = async (email: string, password: string) => {
    try {
      console.log('🔐 Attempting login for:', email);
      
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      let data;
      try {
        data = await parseJsonResponse(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Login failed';
        throw new Error(message);
      }

      console.log('📦 Login response:', data);

      if (!response.ok) {
        const error = new Error(data.error || data.message || 'Login failed');
        (error as any).requiresVerification = data.requiresVerification || false;
        (error as any).statusCode = response.status;
        throw error;
      }

      const mergedUser = await mergeStoredUserData(data.user);
      if (mergedUser) {
        await AsyncStorage.setItem('userData', JSON.stringify(mergedUser));
      }
      
      setAuthToken(data.token);
      setUser(mergedUser);
      
      console.log('✅ Login successful for:', mergedUser?.email || data.user?.email);
      return data;
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  };

  // Register function
  const register = async (firstName: string, lastName: string, email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });

      const data = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Registration failed');
      }

      await AsyncStorage.setItem('pendingVerificationEmail', email);
      await AsyncStorage.setItem('pendingUserData', JSON.stringify({ firstName, lastName, email }));
      return data;
    } catch (error) {
      throw error;
    }
  };

  // Verify email with 6-digit code and auto-login to Onboarding screen (for new users)
  const verifyEmail = async (code: string, email?: string) => {
    try {
      const emailToVerify = email || (await AsyncStorage.getItem('pendingVerificationEmail'));
      const pendingUserDataStr = await AsyncStorage.getItem('pendingUserData');
      const pendingUserData = pendingUserDataStr ? JSON.parse(pendingUserDataStr) : {};

      if (!emailToVerify) {
        throw new Error('Email is missing for verification');
      }

      const response = await fetch(`${API_URL}/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailToVerify, code }),
      });

      const data = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Email verification failed');
      }

      const isAlreadyOnboarded = Boolean(data.user?.onboardingCompleted || false);

      const storedUserData = await AsyncStorage.getItem('userData');
      const previousUser = storedUserData ? JSON.parse(storedUserData) : null;

      const verifiedUser: User = {
        id: data.user?.id || previousUser?.id || user?.id || 'user_' + Date.now(),
        email: emailToVerify,
        firstName: data.user?.firstName || previousUser?.firstName || user?.firstName || pendingUserData.firstName || '',
        lastName: data.user?.lastName || previousUser?.lastName || user?.lastName || pendingUserData.lastName || '',
        emailVerified: true,
        onboardingCompleted: Boolean(isAlreadyOnboarded || previousUser?.onboardingCompleted || false),
        profile: data.user?.profile || previousUser?.profile || user?.profile || null,
      };

      const sessionToken = data.token || authToken || `token_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      await AsyncStorage.setItem('authToken', sessionToken);
      setAuthToken(sessionToken);
      
      await AsyncStorage.setItem('userData', JSON.stringify(verifiedUser));
      setUser(verifiedUser);

      await AsyncStorage.removeItem('pendingVerificationEmail');
      await AsyncStorage.removeItem('pendingUserData');
      return data;
    } catch (error) {
      throw error;
    }
  };

  // Forgot password / password reset request
  const forgotPassword = async (email: string) => {
    const normalizedEmail = email.trim();
    const endpoints = [
      '/forgot-password',
      '/password-reset',
      '/request-password-reset',
      '/reset-password'
    ];

    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${API_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: normalizedEmail }),
        });

        if (response.status === 404) {
          continue;
        }

        const data = await parseJsonResponse(response);

        if (!response.ok) {
          throw new Error(data.error || data.message || 'Failed to request password reset');
        }

        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Failed to request password reset');
      }
    }

    throw lastError || new Error('Unable to send password reset email right now.');
  };

  // Resend verification email
  const resendVerification = async (email: string) => {
    try {
      const response = await fetch(`${API_URL}/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to resend verification email');
      }

      return data;
    } catch (error) {
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('pendingVerificationEmail');
      
      setAuthToken(null);
      setUser(null);
    } catch (error) {
      console.error('Error during logout:', error);
      throw error;
    }
  };

  // Save onboarding profile to server (with local fallback)
  const saveOnboardingProfile = async (profileData: OnboardingProfile) => {
    try {
      console.log('📤 Saving onboarding profile...', profileData);

      const normalizedProfile: any = {
        ...profileData,
        academicLevel: profileData.qualification,
        fieldOfStudy: profileData.fieldOfStudy || '',
        studyStyle: profileData.learningStyle,
        studyHoursPerDay: profileData.studyHours || '',
        studyDaysPerWeek: profileData.studyDaysPerWeek ?? '',
        preferredStudyTime: profileData.productiveTime,
        studyChallenges: profileData.studyChallenges || [],
      };
      
      let token = await AsyncStorage.getItem('authToken');
      if (!token && authToken) {
        token = authToken;
      }
      if (!token) {
        token = `token_${Date.now()}`;
        await AsyncStorage.setItem('authToken', token);
        setAuthToken(token);
      }

      let data: any = { success: true, profile: normalizedProfile };
      try {
        const response = await fetch(`${API_URL}/onboarding`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(normalizedProfile),
        });

        if (response.ok) {
          data = await response.json();
        }
      } catch (networkError) {
        console.warn('⚠️ Network profile save note, storing locally:', networkError);
      }

      const savedProfile = data?.profile || normalizedProfile;
      const updatedUser: User = { 
        ...user, 
        ...(data?.user || {}),
        id: user?.id || data?.user?.id || 'user_' + Date.now(),
        email: user?.email || data?.user?.email || '',
        firstName: user?.firstName || data?.user?.firstName || '',
        lastName: user?.lastName || data?.user?.lastName || '',
        emailVerified: true,
        onboardingCompleted: true,
        profile: savedProfile
      };
      
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      await AsyncStorage.setItem('onboardingCompleted', 'true');
      await AsyncStorage.setItem('onboardingProfile', JSON.stringify(savedProfile));
      setUser(updatedUser);

      return data;
    } catch (error: any) {
      console.error('❌ Error saving onboarding profile:', error);
      if (user) {
        const fallbackUser: User = { 
          ...user, 
          emailVerified: true,
          onboardingCompleted: true,
          profile: {
            ...profileData,
            academicLevel: profileData.qualification,
            fieldOfStudy: profileData.fieldOfStudy || '',
            studyStyle: profileData.learningStyle,
            studyHoursPerDay: profileData.studyHours || '',
            studyDaysPerWeek: profileData.studyDaysPerWeek ?? '',
            preferredStudyTime: profileData.productiveTime,
            studyChallenges: profileData.studyChallenges || [],
          } as any
        };
        await AsyncStorage.setItem('userData', JSON.stringify(fallbackUser));
        await AsyncStorage.setItem('onboardingCompleted', 'true');
        await AsyncStorage.setItem('onboardingProfile', JSON.stringify(fallbackUser.profile));
        setUser(fallbackUser);
      }
      return { success: true, profile: {
        ...profileData,
        academicLevel: profileData.qualification,
        fieldOfStudy: profileData.fieldOfStudy || '',
        studyStyle: profileData.learningStyle,
        studyHoursPerDay: profileData.studyHours || '',
        studyDaysPerWeek: profileData.studyDaysPerWeek ?? '',
        preferredStudyTime: profileData.productiveTime,
        studyChallenges: profileData.studyChallenges || [],
      } as any };
    }
  };

  // Get onboarding profile from server
  const getOnboardingProfile = async (): Promise<OnboardingProfile | null> => {
    try {
      const data = await authenticatedFetch('/onboarding');
      return data.profile || null;
    } catch (error: any) {
      if (error.message.includes('404') || error.message.includes('not found')) {
        return user?.profile || null;
      }
      console.error('Error fetching onboarding profile:', error);
      return user?.profile || null;
    }
  };

  // Complete onboarding
  const completeOnboarding = async () => {
    if (user) {
      const updatedUser = { ...user, onboardingCompleted: true };
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  // Update user data (and profile sync)
  const updateUser = async (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      setUser(updatedUser);

      // Attempt background backend sync if profile data updated
      if (userData.profile || userData.firstName || userData.lastName) {
        try {
          await authenticatedFetch('/profile', {
            method: 'PUT',
            body: JSON.stringify({
              firstName: userData.firstName,
              lastName: userData.lastName,
              ...(userData.profile || {})
            }),
          });
        } catch (err) {
          console.log('Background profile sync note:', err);
        }
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        forgotPassword,
        logout,
        verifyEmail,
        resendVerification,
        completeOnboarding,
        updateUser,
        saveOnboardingProfile,
        getOnboardingProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};