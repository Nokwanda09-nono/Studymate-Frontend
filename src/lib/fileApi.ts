import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../config/api";

interface RemoteFileResponse {
  id?: string;
  fileId?: string;
  error?: string;
  message?: string;
  details?: string;
  url?: string;
  uri?: string;
  file?: {
    id?: string;
    url?: string;
    uri?: string;
  };
}

export interface RemoteStoredFile {
  id: string;
  remoteId: string;
  moduleId: string;
  moduleName?: string;
  name: string;
  type: string;
  size: number;
  uri: string;
  url?: string;
  uploadedAt: string;
  createdAt?: string;
}

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await AsyncStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function fetchUserFiles(): Promise<RemoteStoredFile[]> {
  const response = await fetch(`${API_URL}/files`, {
    headers: await getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "The server could not load your files.");
  }
  return data.files || [];
}

export async function uploadFileToDatabase(params: {
  moduleId: string;
  moduleName?: string;
  uri: string;
  name: string;
  type: string;
  size: number;
}): Promise<{ remoteId: string; remoteUri?: string }> {
  const localFileResponse = await fetch(params.uri);
  if (!localFileResponse.ok) {
    throw new Error("The selected file could not be read from device storage.");
  }

  const fileBlob = await localFileResponse.blob();
  const formData = new FormData();
  formData.append("moduleId", params.moduleId);
  if (params.moduleName) formData.append("moduleName", params.moduleName);
  formData.append("name", params.name);
  formData.append("size", String(params.size));
  formData.append("file", fileBlob, params.name);

  const response = await fetch(`${API_URL}/files`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: formData,
  });

  let data: RemoteFileResponse = {};
  try {
    data = (await response.json()) as RemoteFileResponse;
  } catch {
    throw new Error(`Upload failed with HTTP ${response.status}.`);
  }

  if (!response.ok) {
    throw new Error(
      data.details || data.error || data.message || data.fileId ||
      `The server could not store this file (HTTP ${response.status}).`,
    );
  }

  const remoteFile = data.file || data;
  const remoteId = remoteFile.id || data.fileId;
  if (!remoteId) {
    throw new Error("The server stored the file without returning its ID.");
  }

  return {
    remoteId,
    remoteUri: remoteFile.uri || remoteFile.url,
  };
}

export async function deleteFileFromDatabase(remoteId: string): Promise<void> {
  const response = await fetch(`${API_URL}/files/${encodeURIComponent(remoteId)}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
  });

  if (!response.ok && response.status !== 404) {
    throw new Error("The server could not delete this file.");
  }
}
