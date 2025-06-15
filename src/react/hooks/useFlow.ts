import { useEffect, useRef, useCallback } from "react";
import onbored from "../../onbored";

type StepOptions = Record<string, any>;

export function useFlow(flowName: string, isOpen: boolean) {
  const hasStarted = useRef(false);

  // Start the flow only once when open becomes true
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isOpen && !hasStarted.current) {
      void onbored.flow(flowName);
      hasStarted.current = true;
    }

    if (!isOpen) {
      hasStarted.current = false;
    }
  }, [isOpen, flowName]);

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
