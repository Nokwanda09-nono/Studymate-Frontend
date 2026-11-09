import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extractHost = (uri) => {
  if (!uri) return null;
  const withoutScheme = uri.replace(/^[a-z]+:\/\//i, '');
  const host = withoutScheme.split(':')[0].split('/')[0];
  return host || null;
};

const resolveApiUrl = () => {
  if (Platform.OS === 'web') {
    const webHost = (typeof window !== 'undefined' && window?.location?.hostname) || 'localhost';
    let explicit = process.env.EXPO_PUBLIC_API_URL || process.env.BACKEND_URL;

    if (explicit) {
      explicit = explicit.replace(':8081', ':5001').replace(':5000', ':5001').replace('10.0.2.2', webHost);
      let cleanUrl = explicit.replace(/\/$/, '');
      if (!cleanUrl.endsWith('/api')) {
        cleanUrl += '/api';
      }
      console.log('🔗 API_URL for Web resolved to:', cleanUrl);
      return cleanUrl;
    }
    return `http://${webHost}:5001/api`;
  }

  // 1. Check Expo Host URI (dynamically detects PC Wi-Fi IP e.g. 10.7.52.171 on physical phone)
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

  // Fallback to PC Wi-Fi IP if hostUri is unavailable on native build
  const localPcIp = (expoHost && expoHost !== 'localhost' && expoHost !== '127.0.0.1') ? expoHost : '10.7.52.171';

  let explicit = process.env.EXPO_PUBLIC_API_URL || process.env.BACKEND_URL;
  if (explicit) {
    explicit = explicit
      .replace(':8081', ':5001')
      .replace(':5000', ':5001')
      .replace('10.0.2.2', localPcIp)
      .replace('localhost', localPcIp);

    let cleanUrl = explicit.replace(/\/$/, '');
    if (!cleanUrl.endsWith('/api')) {
      cleanUrl += '/api';
    }
    console.log('🔗 API_URL for Native resolved to:', cleanUrl);
    return cleanUrl;
  }

  return `http://${localPcIp}:5001/api`;
};

export const API_URL = resolveApiUrl();
