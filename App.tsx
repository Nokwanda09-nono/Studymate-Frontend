import { NavigationContainer } from "@react-navigation/native";
import * as Linking from 'expo-linking';
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { StoreProvider } from "./src/context/StoreContext";
import { AppNavigator } from "./src/navigation/AppNavigator";

// Configure deep linking
const linking = {
  prefixes: [
    'studymate://',
    Linking.createURL('/'), // For Expo Go development
  ],
  config: {
    screens: {
      VerifyEmail: 'verify-email',
      Login: 'login',
      Register: 'register',
      Home: 'home',
    },
  },
  // Handle when app is opened from a deep link
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url != null) {
      return url;
    }
    // Check if there is a cached URL
    const cachedUrl = await Linking.getInitialURL();
    return cachedUrl;
  },
  subscribe(listener: (url: string) => void) {
    const onReceiveURL = ({ url }: { url: string }) => listener(url);
    const subscription = Linking.addEventListener('url', onReceiveURL);
    return () => subscription.remove();
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <AuthProvider>
          <NavigationContainer linking={linking}>
            <AppNavigator />
          </NavigationContainer>
        </AuthProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}