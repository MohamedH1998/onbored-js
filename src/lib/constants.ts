import { version } from './version';

let JS_ENV = '';
if (typeof (globalThis as unknown as { Deno: unknown }).Deno !== 'undefined') {
  JS_ENV = 'deno';
} else if (typeof document !== 'undefined') {
  JS_ENV = 'web';
} else if (
  typeof navigator !== 'undefined' &&
  navigator.product === 'ReactNative'
) {
  JS_ENV = 'react-native';
} else {
  JS_ENV = 'node';
}

export const DEFAULT_HEADERS = {
  'X-Client-Info': `onbored-js-${JS_ENV}/${version}`,
  'Content-Type': 'application/json',
};

export const DEFAULT_GLOBAL_OPTIONS = {
  headers: DEFAULT_HEADERS,
  // TODO: update apiHost to use real api
  apiHost: 'https://api.onbored.com',
  env: 'production',
  debug: false,
  intervals: {
    retry: 5000, // 5 seconds
  },
  sessionReplay: {
    // TODO: update apiHost to use real api
    apiHost: 'https://api.onbored.com',
    flush_interval: 10000,
    mask_inputs: true,
    block_elements: [],
    on_error: (err: Error) => {
      console.error('Session replay error:', err);
    },
  },
};
