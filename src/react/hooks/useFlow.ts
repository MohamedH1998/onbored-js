import { useEffect, useCallback } from "react";
import onbored from "../../onbored"; // adjust path

type StepOptions = Record<string, any>;

export function useFlow(flowName: string) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    void onbored.flow(flowName); // 🚀 starts or queues
  }, [flowName]);

  const step = useCallback(
    (stepName: string, options: StepOptions = {}) => {
      onbored.step(stepName, { flow: flowName, ...options });
    },
    [flowName]
  );

  const skip = useCallback(
    (stepName: string, options: StepOptions = {}) => {
      onbored.skip(stepName, { flow: flowName, ...options });
    },
    [flowName]
  );

  const complete = useCallback(
    (options: StepOptions = {}) => {
      onbored.completed({ flow: flowName, ...options });
    },
    [flowName]
  );

  return { step, skip, complete };
}
