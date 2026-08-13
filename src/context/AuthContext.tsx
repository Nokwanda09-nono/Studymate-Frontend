import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from "react";
import { API_URL as CONFIG_API_URL } from "../config/api";

const API_URL = CONFIG_API_URL || 'https://study-mate-v1-ten.vercel.app/api';

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
  academicGoal: string;
  learningStyle: string;
  studyChallenges: string[];
  studyHours: string;
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

  // Load user from storage on app start
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const userData = await AsyncStorage.getItem('userData');
        
        if (token && userData) {
          setAuthToken(token);
          setUser(JSON.parse(userData));
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

    const data = await response.json();

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

      const data = await response.json();
      console.log('📦 Login response:', data);

      if (!response.ok) {
        const error = new Error(data.error || 'Login failed');
        (error as any).requiresVerification = data.requiresVerification || false;
        (error as any).statusCode = response.status;
        throw error;
      }

      await AsyncStorage.setItem('authToken', data.token);
      await AsyncStorage.setItem('userData', JSON.stringify(data.user));
      
      setAuthToken(data.token);
      setUser(data.user);
      
      console.log('✅ Login successful for:', data.user.email);
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Email verification failed');
      }

      const isAlreadyOnboarded = Boolean(data.user?.onboardingCompleted || false);

      const verifiedUser: User = {
        id: data.user?.id || user?.id || 'user_' + Date.now(),
        email: emailToVerify,
        firstName: data.user?.firstName || user?.firstName || pendingUserData.firstName || '',
        lastName: data.user?.lastName || user?.lastName || pendingUserData.lastName || '',
        emailVerified: true,
        onboardingCompleted: isAlreadyOnboarded,
        profile: data.user?.profile || user?.profile || null,
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend verification email');
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
      await AsyncStorage.removeItem('userData');
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
      
      let token = await AsyncStorage.getItem('authToken');
      if (!token && authToken) {
        token = authToken;
      }
      if (!token) {
        token = `token_${Date.now()}`;
        await AsyncStorage.setItem('authToken', token);
        setAuthToken(token);
      }

      let data: any = { success: true, profile: profileData };
      try {
        const response = await fetch(`${API_URL}/onboarding`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(profileData),
        });

        if (response.ok) {
          data = await response.json();
        }
      } catch (networkError) {
        console.warn('⚠️ Network profile save note, storing locally:', networkError);
      }

      const updatedUser: User = { 
        ...user, 
        ...(data?.user || {}),
        id: user?.id || data?.user?.id || 'user_' + Date.now(),
        email: user?.email || data?.user?.email || '',
        firstName: user?.firstName || data?.user?.firstName || '',
        lastName: user?.lastName || data?.user?.lastName || '',
        emailVerified: true,
        onboardingCompleted: true,
        profile: data?.profile || profileData
      };
      
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      setUser(updatedUser);

      return data;
    } catch (error: any) {
      console.error('❌ Error saving onboarding profile:', error);
      if (user) {
        const fallbackUser: User = { 
          ...user, 
          emailVerified: true,
          onboardingCompleted: true,
          profile: profileData
        };
        await AsyncStorage.setItem('userData', JSON.stringify(fallbackUser));
        setUser(fallbackUser);
      }
      return { success: true, profile: profileData };
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