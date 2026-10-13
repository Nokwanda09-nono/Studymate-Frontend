import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { CustomButton } from '../components/CustomButton';
import { useStore } from '../context/StoreContext';
import type { RootStackParamList } from '../navigation/types';

export function PDFViewerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PDFViewer'>>();
  const { fileId } = route.params;
  const { files } = useStore();
  const [loading, setLoading] = useState(true);

  const file = files.find((f) => f.id === fileId);

  if (!file) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>File not found</Text>
          <CustomButton title="Go Back" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const openExternally = async () => {
    try {
      if (!file.uri) {
        Alert.alert('Cannot open file', 'This PDF has no available file location.');
        return;
      }

      if (Platform.OS === 'android' && file.uri.startsWith('file://')) {
        const contentUri = await FileSystem.getContentUriAsync(file.uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: 'application/pdf',
        });
        return;
      }

      if (Platform.OS === 'ios' && file.uri.startsWith('file://')) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf' });
          return;
        }
      }

      const canOpen = await Linking.canOpenURL(file.uri);
      if (!canOpen) {
        Alert.alert('Cannot open file', 'No app available to view this PDF.');
        return;
      }

      await Linking.openURL(file.uri);
    } catch (err) {
      console.error('Open externally error:', err);
      Alert.alert('Error', 'Could not open the PDF.');
    }
  };

  // On web: render inside WebView
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {file.name}
              </Text>
            </View>
          </View>
        </View>

        {loading && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loaderText}>Loading PDF...</Text>
          </View>
        )}

        <WebView
          source={{ uri: file.uri }}
          style={[styles.webview, loading && styles.hidden]}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </SafeAreaView>
    );
  }

  // Expo Go cannot render PDFs natively. Open the local PDF with a supported
  // system viewer instead of importing a custom native PDF module.
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {file.name}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.errorContainer}>
        <Ionicons name="document-text-outline" size={64} color="#9ca3af" />
        <Text style={[styles.errorText, { color: '#e5e7eb', marginTop: 16 }]}>
          PDF preview isn't available inside the app.
        </Text>
        <Text style={{ color: '#9ca3af', marginBottom: 24, textAlign: 'center' }}>
          Open it with your device's PDF viewer instead.
        </Text>
        <CustomButton title="Open PDF" onPress={openExternally} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1f2937' },
  header: { backgroundColor: '#374151', paddingHorizontal: 16, paddingVertical: 12 },
  headerContent: { flexDirection: 'row', alignItems: 'center' },
  backButton: { padding: 4, marginRight: 12 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '500', color: 'white' },
  webview: { flex: 1, backgroundColor: '#f3f4f6' },
  hidden: { opacity: 0 },
  loaderContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  loaderText: { marginTop: 12, fontSize: 14, color: '#6b7280' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  errorText: { fontSize: 16, color: '#ef4444', marginBottom: 16 },
});