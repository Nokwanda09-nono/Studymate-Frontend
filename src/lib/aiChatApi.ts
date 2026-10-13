import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../config/api";

interface ChatApiResponse {
  error?: string;
  success?: boolean;
  session?: ChatSession;
  sessions?: ChatSession[];
  messages?: ChatMessage[];
  aiMessage?: {
    message?: string;
  };
}

export interface ChatSession {
  id: number | string;
  session_title: string;
  context: string;
  module_id: number | null;
  module_name: string | null;
  messages_count: number;
  last_message_at: string;
}

export interface ChatMessage {
  id: number | string;
  sender: string;
  message: string;
  created_at: string;
}

async function authenticatedRequest(
  endpoint: string,
  options: { method?: "GET" | "POST"; body?: Record<string, string | number> } = {},
): Promise<ChatApiResponse> {
  const storedToken = await AsyncStorage.getItem("authToken");
  const token = storedToken?.trim().replace(/^(?:Bearer\s+)+/i, "");
  if (!token) {
    throw new Error("Please sign in again to use AI chat.");
  }
  if (/\s/.test(token)) {
    throw new Error("Your saved login session is invalid. Please sign out and sign in again.");
  }

  const method = options.method ?? "POST";
  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers: {
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${token}`,
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (error) {
    console.error(`AI chat request failed (${endpoint}):`, error);
    throw new Error(
      "Could not reach the StudyMate server. Check that the backend is running and the API URL is reachable from this device.",
    );
  }

  let data: ChatApiResponse;
  try {
    data = (await response.json()) as ChatApiResponse;
  } catch {
    throw new Error(`The StudyMate server returned an invalid response (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(data.error || `AI chat failed (HTTP ${response.status}).`);
  }

  return data;
}

export async function fetchChatSessions(): Promise<ChatSession[]> {
  const data = await authenticatedRequest("/chat/sessions", { method: "GET" });
  return data.sessions ?? [];
}

export async function fetchChatMessages(
  sessionId: string | number,
): Promise<ChatMessage[]> {
  const data = await authenticatedRequest(
    `/chat/session/${encodeURIComponent(String(sessionId))}`,
    { method: "GET" },
  );
  return data.messages ?? [];
}

export async function createChatSession(options: {
  title: string;
  moduleName?: string | null;
}): Promise<string | number> {
  const data = await authenticatedRequest("/chat/session", {
    body: {
      title: options.title,
      context: options.moduleName ? "academic" : "general",
      ...(options.moduleName ? { moduleName: options.moduleName } : {}),
    },
  });
  const sessionId = data.session?.id;
  if (sessionId === undefined || sessionId === null) {
    throw new Error("The server did not return a chat session ID.");
  }
  return sessionId;
}

export async function sendChatMessage(
  sessionId: string | number,
  message: string,
): Promise<string> {
  const data = await authenticatedRequest("/chat/message", {
    body: { sessionId, message },
  });
  const answer = data.aiMessage?.message?.trim();
  if (!answer) {
    throw new Error("The AI returned an empty response. Please try again.");
  }
  return answer;
}
