import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../config/api";
import { QuizQuestion } from "./store";

export async function generateModuleQuiz(
  moduleId: string,
  moduleName: string,
  questionCount: number,
): Promise<QuizQuestion[]> {
  const token = await AsyncStorage.getItem("authToken");
  const response = await fetch(`${API_URL}/modules/${encodeURIComponent(moduleId)}/generate-quiz`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ questionCount, moduleName }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.details || data.error || "The AI could not generate a quiz for this module.");
  }

  return data.questions as QuizQuestion[];
}
