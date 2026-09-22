import Constants from 'expo-constants';
import { Platform } from 'react-native';

const FALLBACK_LOCAL = Platform.OS === 'android'
  ? 'http://10.40.114.12:5000/api'
  : 'http://localhost:5000/api';

const extractHost = (uri) => {
  if (!uri) return null;
  const withoutScheme = uri.replace(/^[a-z]+:\/\//i, '');
  const host = withoutScheme.split(':')[0].split('/')[0];
  return host || null;
};

const resolveApiUrl = () => {
  // 1. Explicit override
  const explicit = process.env.EXPO_PUBLIC_API_URL || process.env.BACKEND_URL;
  if (explicit) {
    console.log('🔗 API_URL from env:', explicit);
    return explicit.replace(/\/$/, '');
  }

  // 2. Auto-detect in dev
  if (__DEV__) {
    const candidates = {
      expoConfigHostUri: Constants.expoConfig?.hostUri,
      manifest2DebuggerHost: Constants.manifest2?.extra?.expoGo?.debuggerHost,
      manifestDebuggerHost: Constants.manifest?.debuggerHost,
      linkingUri: Constants.linkingUri,
      expoGoConfigHostUri: Constants.expoGoConfig?.debuggerHost,
    };

    console.log('🔍 Expo host candidates:', candidates);

    for (const [key, uri] of Object.entries(candidates)) {
      const host = extractHost(uri);
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        const url = `http://${host}:5000/api`;
        console.log(`🔗 API_URL resolved from ${key}:`, url);
        return url;
      }
    }

    console.log('⚠️ Auto-detect failed, using fallback:', FALLBACK_LOCAL);
    return FALLBACK_LOCAL;
  }

  // 3. Production
  return 'https://study-mate-v1-ten.vercel.app/api';
};

export const API_URL = resolveApiUrl();