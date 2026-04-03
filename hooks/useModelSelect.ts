"use client";

import { useCallback, useEffect, useState } from "react";

import { AVAILABLE_MODELS, DEFAULT_MODEL_ID, isValidModel } from "@/lib/models";
import type { ModelOption } from "@/lib/models";
import { getSetting, setSetting } from "@/lib/db/settings";

const SETTING_KEY = "selected-model";

interface UseModelSelectReturn {
  selectedModel: string;
  selectedModelOption: ModelOption;
  models: ModelOption[];
  setModel: (modelId: string) => void;
}

export function useModelSelect(): UseModelSelectReturn {
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);

  useEffect(() => {
    getSetting(SETTING_KEY)
      .then((stored) => {
        if (stored && isValidModel(stored)) {
          setSelectedModel(stored);
        }
      })
      .catch(() => {
        // 로드 실패 시 기본값 유지
      });
  }, []);

  const setModel = useCallback((modelId: string) => {
    if (!isValidModel(modelId)) return;
    setSelectedModel(modelId);
    setSetting(SETTING_KEY, modelId);
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
