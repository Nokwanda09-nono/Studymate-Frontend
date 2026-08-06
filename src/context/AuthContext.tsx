import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from "react";

// Define User type
interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  onboardingCompleted?: boolean;
  profile?: OnboardingProfile | null;
}

interface OnboardingProfile {
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
  login: (email: string, password: string) => Promise<void>;
  register: (firstName: string, lastName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  completeOnboarding: (profileData: OnboardingProfile) => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  saveOnboardingProfile: (profileData: OnboardingProfile) => Promise<void>;
  getOnboardingProfile: () => Promise<OnboardingProfile | null>;
}

// API Base URL - change this to your backend URL
const API_URL = 'https://study-mate-v1-ten.vercel.app/api';

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
    return fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    });
  };

  // Login function
  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error || 'Login failed');
        (error as any).requiresVerification = data.requiresVerification || false;
        (error as any).statusCode = response.status;
        throw error;
      }

      // Save token and user data
      await AsyncStorage.setItem('authToken', data.token);
      await AsyncStorage.setItem('userData', JSON.stringify(data.user));
      
      setAuthToken(data.token);
      setUser(data.user);
    } catch (error) {
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

      if (data.user) {
        await AsyncStorage.setItem('pendingVerificationEmail', email);
      }

      return data;
    } catch (error) {
      throw error;
    }
  };

  // Verify email with token
  const verifyEmail = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/verify-email?token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Email verification failed');
      }

      if (user) {
        const updatedUser = { ...user, emailVerified: true };
        await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
        setUser(updatedUser);
      }

      await AsyncStorage.removeItem('pendingVerificationEmail');

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

  // Save onboarding profile to server
  const saveOnboardingProfile = async (profileData: OnboardingProfile) => {
    try {
      const response = await authenticatedFetch('/onboarding', {
        method: 'POST',
        body: JSON.stringify(profileData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save onboarding profile');
      }

      // Update user data with onboarding status and profile
      if (user) {
        const updatedUser = { 
          ...user, 
          onboardingCompleted: true,
          profile: profileData
        };
        await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
        setUser(updatedUser);
      }

      return data;
    } catch (error) {
      console.error('Error saving onboarding profile:', error);
      throw error;
    }
  };

  // Get onboarding profile from server
  const getOnboardingProfile = async (): Promise<OnboardingProfile | null> => {
    try {
      const response = await authenticatedFetch('/onboarding');
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No profile found
        }
        throw new Error('Failed to fetch onboarding profile');
      }

      const data = await response.json();
      return data.profile;
    } catch (error) {
      console.error('Error fetching onboarding profile:', error);
      return null;
    }
  };

  // Complete onboarding (legacy method - use saveOnboardingProfile instead)
  const completeOnboarding = async () => {
    if (user) {
      const updatedUser = { ...user, onboardingCompleted: true };
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  // Update user data
  const updateUser = async (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      setUser(updatedUser);
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