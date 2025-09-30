import { useEffect, useCallback } from 'react';
import { onbored } from '../../lib';

type StepOptions = Record<string, unknown>;

export function useFlow(slug: string) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkInit = () => {
      try {
        onbored._get();
        onbored.flow(slug);
      } catch (error) {
        setTimeout(checkInit, 100);
      }
    };

    checkInit();
  }, [slug]);

  const step = useCallback(
    (stepName: string, options: StepOptions = {}) => {
      try {
        onbored.step(stepName, { slug, ...options });
      } catch (error) {
        console.warn('[useFlow] SDK not initialized yet:', error);
      }
    },
    [slug]
  );

  const skip = useCallback(
    (stepName: string, options: StepOptions = {}) => {
      try {
        onbored.skip(stepName, { slug, ...options });
      } catch (error) {
        console.warn('[useFlow] SDK not initialized yet:', error);
      }
    },
    [slug]
  );

  const complete = useCallback(
    (options: StepOptions = {}) => {
      try {
        onbored.completed({ slug, ...options });
      } catch (error) {
        console.warn('[useFlow] SDK not initialized yet:', error);
      }
    },
    [slug]
  );

  return { step, skip, complete };
}
