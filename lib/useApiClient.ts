'use client';

import { useMemo } from "react";
import { useSettings } from "@/components/settings-context";
import { createApiClient } from "./apiClient";

export function useApiClient() {
  const { settings } = useSettings();
  return useMemo(
    () => (settings.baseUrl ? createApiClient(settings) : null),
    [settings],
  );
}
