import { useEffect, useCallback } from "react";
import { useOnbored } from "../provider";

type StepOptions = Record<string, any>;

export function useFlow(funnelSlug: string) {
  const { client, isInitialized } = useOnbored();

  useEffect(() => {
    if (typeof window === "undefined" || !client || !isInitialized) return;

    try {
      void client.flow(funnelSlug);
    } catch (error) {
      console.error(`[useFlow] Failed to start flow ${funnelSlug}:`, error);
    }
  }, [client, isInitialized, funnelSlug]);

  const step = useCallback(
    (stepName: string, options: StepOptions = {}) => {
      if (!client) {
        console.warn("[useFlow] Client not initialized");
        return;
      }

      try {
        client.step(stepName, { funnelSlug: funnelSlug, ...options });
      } catch (error) {
        console.error(`[useFlow] Failed to record step ${stepName}:`, error);
      }
    },
    [client, funnelSlug]
  );

  const skip = useCallback(
    (stepName: string, options: StepOptions = {}) => {
      if (!client) {
        console.warn("[useFlow] Client not initialized");
        return;
      }

      try {
        client.skip(stepName, { funnelSlug: funnelSlug, ...options });
      } catch (error) {
        console.error(`[useFlow] Failed to record skip ${stepName}:`, error);
      }
    },
    [client, funnelSlug]
  );

  const complete = useCallback(
    (options: StepOptions = {}) => {
      if (!client) {
        console.warn("[useFlow] Client not initialized");
        return;
      }

      try {
        client.completed({ funnelSlug: funnelSlug, ...options });
      } catch (error) {
        console.error(
          `[useFlow] Failed to complete flow ${funnelSlug}:`,
          error
        );
      }
    },
    [client, funnelSlug]
  );

  return {
    step,
    skip,
    complete,
    isReady: !!client && isInitialized,
  };
}
