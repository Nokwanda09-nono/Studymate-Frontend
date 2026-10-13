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

const isPrivateIPv4 = (host) => {
  const octets = host.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
};

const resolveApiUrl = () => {
  let expoHost = null;
  if (__DEV__) {
    const candidates = [
      Constants.expoConfig?.hostUri,
      Constants.manifest2?.extra?.expoGo?.debuggerHost,
      Constants.manifest?.debuggerHost,
      Constants.linkingUri,
      Constants.expoGoConfig?.debuggerHost,
    ];
    expoHost = candidates.map(extractHost).find(Boolean) || null;
  }

  // 1. Explicit override
  const explicit = process.env.EXPO_PUBLIC_API_URL || process.env.BACKEND_URL;
  if (explicit) {
    const configuredUrl = explicit.replace(/\/$/, '');
    let configuredHost = null;
    try {
      configuredHost = new URL(configuredUrl).hostname;
    } catch {
      console.warn('⚠️ The configured backend URL is invalid.');
      return configuredUrl;
    }

    // Local network addresses can change; use the host serving Expo when available.
    if (
      __DEV__ &&
      expoHost &&
      isPrivateIPv4(configuredHost) &&
      isPrivateIPv4(expoHost) &&
      configuredHost !== expoHost
    ) {
      const url = `http://${expoHost}:5000/api`;
      console.log('🔗 API_URL resolved from current Expo host:', url);
      return url;
    }

    console.log('🔗 API_URL from env:', explicit);
    return configuredUrl;
  }

  // 2. Auto-detect in dev
  if (__DEV__) {
    if (expoHost && expoHost !== 'localhost' && expoHost !== '127.0.0.1') {
      const url = `http://${expoHost}:5000/api`;
      console.log('🔗 API_URL resolved from Expo host:', url);
      return url;
    }

    console.log('⚠️ Auto-detect failed, using fallback:', FALLBACK_LOCAL);
    return FALLBACK_LOCAL;
  }

  // 3. Production
  return 'https://study-mate-v1-ten.vercel.app/api';
};

export const API_URL = resolveApiUrl();