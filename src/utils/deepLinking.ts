import * as Linking from 'expo-linking';

export const getDeepLink = (path: string, params: Record<string, string> = {}) => {
  const queryString = new URLSearchParams(params).toString();
  return Linking.createURL(`/${path}?${queryString}`);
};

export const parseDeepLink = (url: string) => {
  const parsed = Linking.parse(url);
  return {
    path: parsed.path,
    params: parsed.queryParams || {},
  };
};

export const openDeepLink = async (path: string, params: Record<string, string> = {}) => {
  const url = getDeepLink(path, params);
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
    return true;
  }
  return false;
};