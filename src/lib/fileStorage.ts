// src/lib/fileStorage.ts
import * as FileSystem from "expo-file-system/legacy";

const MODULES_DIR = `${FileSystem.documentDirectory}modules/`;

async function ensureModulesDir() {
  const info = await FileSystem.getInfoAsync(MODULES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MODULES_DIR, {
      intermediates: true,
    });
  }
}

/**
 * Copies a picked file from the temporary cache directory
 * into the app's permanent document directory.
 *
 * Returns the new, stable URI that we can store in AsyncStorage.
 */
export async function persistPickedFile(params: {
  uri: string;
  name: string;
}): Promise<string> {
  try {
    await ensureModulesDir();
    const safeName = params.name.replace(/[^\w.\-]/g, "_");
    const dest = `${MODULES_DIR}${Date.now()}-${safeName}`;
    await FileSystem.copyAsync({ from: params.uri, to: dest });
    return dest;
  } catch {
    console.warn("Copy failed — using cache URI (Expo Go only)");
    return params.uri;
  }
}

/**
 * Deletes a persisted file. Safe to call even if the file is gone.
 */
export async function deletePersistedFile(uri: string) {
  if (!uri || !uri.startsWith(FileSystem.documentDirectory ?? "")) {
    // Don't touch anything outside our sandbox.
    return;
  }

  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (e) {
    console.warn("Failed to delete persisted file:", e);
  }
}