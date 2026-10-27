import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../config/api";
import { QuizQuestion } from "./store";

export interface QuizGenParams {
  questionCount: number; // 10 to 20
  questionType?: "mcq_only" | "combination" | "open_ended_only";
  difficulty?: "low" | "medium" | "high";
}

export async function generateModuleQuiz(
  moduleId: string,
  moduleName: string,
  questionCountOrParams: number | QuizGenParams,
): Promise<QuizQuestion[]> {
  const token = await AsyncStorage.getItem("authToken");

  let count = 10;
  let type = "mcq_only";
  let diff = "medium";

  if (typeof questionCountOrParams === "number") {
    count = questionCountOrParams;
  } else if (questionCountOrParams && typeof questionCountOrParams === "object") {
    count = questionCountOrParams.questionCount || 10;
    type = questionCountOrParams.questionType || "mcq_only";
    diff = questionCountOrParams.difficulty || "medium";
  }

  // Ensure count is between 10 and 20
  count = Math.min(Math.max(count, 10), 20);

  const response = await fetch(`${API_URL}/modules/${encodeURIComponent(moduleId)}/generate-quiz`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      questionCount: count,
      questionType: type,
      difficulty: diff,
      moduleName,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.details || data.error || "The AI could not generate a quiz for this module.");
  }

  return data.questions as QuizQuestion[];
}
