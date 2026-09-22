import Constants from 'expo-constants';
import { Platform } from 'react-native';

const FALLBACK_LOCAL = Platform.OS === 'android'
  ? 'http://10.0.2.2:5000/api'   // Android emulator loopback to host
  : 'http://localhost:5000/api'; // iOS simulator

const resolveApiUrl = () => {
  // 1. Explicit override always wins (works in prod and dev)
  const explicit = process.env.EXPO_PUBLIC_API_URL || process.env.BACKEND_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  // 2. In dev, auto-detect the host Metro is served from.
  //    On a physical device via Expo Go, hostUri looks like "192.168.43.123:8081".
  //    That host is your PC, which is also where the backend runs.
  if (__DEV__) {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      Constants.manifest2?.extra?.expoGo?.debuggerHost ||
      Constants.manifest?.debuggerHost;

    if (hostUri) {
      const host = hostUri.split(':')[0];
      // Skip if it resolved to localhost (simulator), fall through to fallback
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `http://${host}:5000/api`;
      }
    }
    return FALLBACK_LOCAL;
  }

  // 3. Production
  return 'https://study-mate-v1-ten.vercel.app/api';
};

export const API_URL = resolveApiUrl();

// Optional: log which URL was chosen so you can confirm in the Metro console
console.log('🔗 API_URL resolved to:', API_URL);