// src/context/AuthContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from "react";
import { API_URL } from "../config/api";
import { INITIAL_STUDY_POINTS, getStudyTier } from "../utils/studyPoints";

interface LoginError extends Error {
  requiresVerification?: boolean;
  statusCode?: number;
}

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
  selectedAvatar?: string;
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

  const mergeStoredUserData = async (
    incomingUser: Partial<User> | null | undefined
  ): Promise<User | null> => {
    try {
      const storedUserData = await AsyncStorage.getItem('userData');
      const parsedStoredUser = storedUserData ? JSON.parse(storedUserData) : null;

      const persistedOnboarding = await AsyncStorage.getItem('onboardingCompleted');

      const mergedUser: User = {
        id: incomingUser?.id || parsedStoredUser?.id || 'user_' + Date.now(),
        email: incomingUser?.email || parsedStoredUser?.email || '',
        firstName: incomingUser?.firstName || parsedStoredUser?.firstName || '',
        lastName: incomingUser?.lastName || parsedStoredUser?.lastName || '',
        emailVerified:
          incomingUser?.emailVerified ??
          parsedStoredUser?.emailVerified ??
          true,
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

  // Require a fresh backend login each time the app starts.
  useEffect(() => {
    const initAuth = async () => {
      try {
        await AsyncStorage.multiRemove(['authToken', 'userData']);
        setAuthToken(null);
        setUser(null);
      } catch (error) {
        console.error('Error clearing the previous login session:', error);
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
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      throw new Error('Enter both your email address and password.');
    }

    let response: Response;
    try {
      response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
    } catch (error) {
      console.error('Login request could not reach the server:', error);
      throw new Error(
        'Could not connect to the StudyMate server. Check your internet connection and confirm the backend is running and reachable from this device.',
      );
    }

    const data = await parseJsonResponse(response);

    if (!response.ok) {
      const error = new Error(
        data.error || data.message || `Login failed (HTTP ${response.status}).`,
      ) as LoginError;
      error.requiresVerification = data.requiresVerification === true;
      error.statusCode = response.status;
      throw error;
    }

    if (typeof data.token !== 'string' || !data.token.trim() || !data.user) {
      throw new Error('The server did not return a valid login session. Please try again.');
    }

    const loginToken = data.token.trim().replace(/^(?:Bearer\s+)+/i, '');
    if (!loginToken || /\s/.test(loginToken)) {
      throw new Error('The server returned an invalid login session. Please try again.');
    }

    let validationResponse: Response;
    try {
      validationResponse = await fetch(`${API_URL}/protected`, {
        headers: {
          Authorization: `Bearer ${loginToken}`,
        },
      });
    } catch (error) {
      console.error('Could not validate the new login session:', error);
      throw new Error(
        'Login succeeded, but the session could not be validated. Check the backend connection and try again.',
      );
    }

    const validationData = await parseJsonResponse(validationResponse);
    if (!validationResponse.ok) {
      throw new Error(
        `Login succeeded, but the backend rejected the session: ${
          validationData.error || `HTTP ${validationResponse.status}`
        }`,
      );
    }

    const mergedUser = await mergeStoredUserData(data.user);
    if (!mergedUser) {
      throw new Error('The server did not return valid account details. Please try again.');
    }

    await AsyncStorage.setItem('userData', JSON.stringify(mergedUser));
    await AsyncStorage.setItem('authToken', loginToken);
    setAuthToken(loginToken);
    setUser(mergedUser);
    return data;
  };

  // Register function
  const register = async (
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ) => {
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
      await AsyncStorage.setItem(
        'pendingUserData',
        JSON.stringify({ firstName, lastName, email })
      );
      return data;
    } catch (error) {
      throw error;
    }
  };

  // Verify email with 6-digit code
  const verifyEmail = async (code: string, email?: string) => {
    try {
      const emailToVerify =
        email || (await AsyncStorage.getItem('pendingVerificationEmail'));
      const pendingUserDataStr = await AsyncStorage.getItem('pendingUserData');
      const pendingUserData = pendingUserDataStr
        ? JSON.parse(pendingUserDataStr)
        : {};

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
        id:
          data.user?.id ||
          previousUser?.id ||
          user?.id ||
          'user_' + Date.now(),
        email: emailToVerify,
        firstName:
          data.user?.firstName ||
          previousUser?.firstName ||
          user?.firstName ||
          pendingUserData.firstName ||
          '',
        lastName:
          data.user?.lastName ||
          previousUser?.lastName ||
          user?.lastName ||
          pendingUserData.lastName ||
          '',
        emailVerified: true,
        onboardingCompleted: Boolean(
          isAlreadyOnboarded || previousUser?.onboardingCompleted || false
        ),
        profile:
          data.user?.profile || previousUser?.profile || user?.profile || null,
      };

      // Only persist a token if the server actually returned one.
      // Do NOT fabricate a fake token — that leads to silent 401s everywhere.
      const sessionToken = data.token || authToken;

      if (sessionToken) {
        await AsyncStorage.setItem('authToken', sessionToken);
        setAuthToken(sessionToken);
      } else {
        console.warn(
          '⚠️ verifyEmail: server did not return a token. User will need to log in.'
        );
      }

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
      '/reset-password',
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
          throw new Error(
            data.error || data.message || 'Failed to request password reset'
          );
        }

        return data;
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error('Failed to request password reset');
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
        throw new Error(
          data.error || data.message || 'Failed to resend verification email'
        );
      }

      return data;
    } catch (error) {
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'authToken',
        'userData',
        'pendingVerificationEmail',
      ]);

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
        studyPoints: INITIAL_STUDY_POINTS,
        studyTier: getStudyTier(INITIAL_STUDY_POINTS).name,
        pointsInitialized: true,
        lowPointsAlertSent: false,
        accountDeletionWarning: false,
      };

      // Read the real token from storage. Do NOT fabricate one.
      let token = await AsyncStorage.getItem('authToken');
      if (!token && authToken) {
        token = authToken;
      }

      let data: any = { success: true, profile: normalizedProfile };

      if (token) {
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
          } else {
            const errBody = await response.json().catch(() => ({}));
            console.warn(
              '⚠️ Onboarding save returned non-OK status, storing locally:',
              response.status,
              errBody
            );
          }
        } catch (networkError) {
          console.warn(
            '⚠️ Network profile save note, storing locally:',
            networkError
          );
        }
      } else {
        console.warn(
          '⚠️ No auth token available — saving onboarding profile locally only.'
        );
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
        profile: savedProfile,
      };

      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      await AsyncStorage.setItem('onboardingCompleted', 'true');
      await AsyncStorage.setItem(
        'onboardingProfile',
        JSON.stringify(savedProfile)
      );
      await AsyncStorage.setItem('profile', JSON.stringify(savedProfile));
      setUser(updatedUser);

      return data;
    } catch (error: any) {
      console.error('❌ Error saving onboarding profile:', error);
      if (user) {
        const fallbackProfile: any = {
          ...profileData,
          academicLevel: profileData.qualification,
          fieldOfStudy: profileData.fieldOfStudy || '',
          studyStyle: profileData.learningStyle,
          studyHoursPerDay: profileData.studyHours || '',
          studyDaysPerWeek: profileData.studyDaysPerWeek ?? '',
          preferredStudyTime: profileData.productiveTime,
          studyChallenges: profileData.studyChallenges || [],
        };
        const fallbackUser: User = {
          ...user,
          emailVerified: true,
          onboardingCompleted: true,
          profile: fallbackProfile,
        };
        await AsyncStorage.setItem('userData', JSON.stringify(fallbackUser));
        await AsyncStorage.setItem('onboardingCompleted', 'true');
        await AsyncStorage.setItem(
          'onboardingProfile',
          JSON.stringify(fallbackProfile)
        );
        await AsyncStorage.setItem('profile', JSON.stringify(fallbackProfile));
        setUser(fallbackUser);
      }
      return {
        success: true,
        profile: {
          ...profileData,
          academicLevel: profileData.qualification,
          fieldOfStudy: profileData.fieldOfStudy || '',
          studyStyle: profileData.learningStyle,
          studyHoursPerDay: profileData.studyHours || '',
          studyDaysPerWeek: profileData.studyDaysPerWeek ?? '',
          preferredStudyTime: profileData.productiveTime,
          studyChallenges: profileData.studyChallenges || [],
        } as any,
      };
    }
  };

  // Get onboarding profile from server
  const getOnboardingProfile = async (): Promise<OnboardingProfile | null> => {
    try {
      const data = await authenticatedFetch('/onboarding');
      return data.profile || null;
    } catch (error: any) {
      if (
        error.message.includes('404') ||
        error.message.includes('not found')
      ) {
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
              ...(userData.profile || {}),
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