import { OnboredClient } from './client';
import { OnboredClientOptions } from './types';

let instance: OnboredClient | null = null;

export const onbored = {
  init: (config: { projectKey: string } & OnboredClientOptions) => {
    if (typeof window === 'undefined') {
      throw new Error('[Onbored] Can only be initialized in the browser');
    }
    if (instance) {
      console.warn('[Onbored] Already initialized');
      return;
    }

    const { projectKey, ...options } = config;
    instance = new OnboredClient(projectKey, options);
  },

  _get() {
    if (!instance) throw new Error('[Onbored] Not initialized');
    return instance;
  },

  flow: (...args: Parameters<OnboredClient['flow']>) =>
    onbored._get().flow(...args),
  step: (...args: Parameters<OnboredClient['step']>) =>
    onbored._get().step(...args),
  skip: (...args: Parameters<OnboredClient['skip']>) =>
    onbored._get().skip(...args),
  complete: (...args: Parameters<OnboredClient['complete']>) =>
    onbored._get().complete(...args),
  capture: (...args: Parameters<OnboredClient['capture']>) =>
    onbored._get().capture(...args),
  reset: () => onbored._get().reset(),
  destroy: () => onbored._get().destroy(),

  // Debug methods for testing
  _getEvents: () => onbored._get()._getEvents(),
  _getFlowContext: (slug: string) => onbored._get()._getFlowContext(slug),
  _getRecorder: () => onbored._get()._getRecorder(),
  _getRecorderEvents: () => onbored._get()._getRecorderEvents(),
  _getSessionId: () => onbored._get()._getSessionId(),
};
