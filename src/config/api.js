import { Platform } from 'react-native';

const resolveApiUrl = () => {
  if (Platform.OS === 'web') {
    const webHost = (typeof window !== 'undefined' && window?.location?.hostname) || 'localhost';
    let explicit = process.env.EXPO_PUBLIC_API_URL || process.env.BACKEND_URL;

    if (explicit) {
      // Replace Metro port 8081 or old port 5000 with backend port 5001
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

  let explicit = process.env.EXPO_PUBLIC_API_URL || process.env.BACKEND_URL;
  if (explicit) {
    explicit = explicit.replace(':8081', ':5001').replace(':5000', ':5001');
    let cleanUrl = explicit.replace(/\/$/, '');
    if (!cleanUrl.endsWith('/api')) {
      cleanUrl += '/api';
    }
    console.log('🔗 API_URL from env:', cleanUrl);
    return cleanUrl;
  }

  return 'http://10.0.2.2:5001/api';
};

export const API_URL = resolveApiUrl();
