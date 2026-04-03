interface AppConfig {
  geminiApiKey: string;
  llmModel: string;
}

export function getConfig(): AppConfig {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const llmModel = process.env.LLM_MODEL ?? "gemini-2.5-flash-lite";

  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.");
  }

  return {
    geminiApiKey,
    llmModel,
  };
}
