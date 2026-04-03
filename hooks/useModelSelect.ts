"use client";

import { useCallback, useEffect, useState } from "react";

import { AVAILABLE_MODELS, DEFAULT_MODEL_ID, isValidModel } from "@/lib/models";
import type { ModelOption } from "@/lib/models";

const STORAGE_KEY = "mcp-chat-service:selected-model";

interface UseModelSelectReturn {
  selectedModel: string;
  selectedModelOption: ModelOption;
  models: ModelOption[];
  setModel: (modelId: string) => void;
}

export function useModelSelect(): UseModelSelectReturn {
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isValidModel(stored)) {
        setSelectedModel(stored);
      }
    } catch {
      // localStorage 접근 실패 시 기본값 유지
    }
  }, []);

  const setModel = useCallback((modelId: string) => {
    if (!isValidModel(modelId)) return;
    setSelectedModel(modelId);
    try {
      localStorage.setItem(STORAGE_KEY, modelId);
    } catch {
      // 저장 실패 무시
    }
  }, []);

  const selectedModelOption =
    AVAILABLE_MODELS.find((m) => m.id === selectedModel) ?? AVAILABLE_MODELS[0];

  return {
    selectedModel,
    selectedModelOption,
    models: AVAILABLE_MODELS,
    setModel,
  };
}
