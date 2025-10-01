import { DEFAULT_GLOBAL_OPTIONS } from './constants';
import { OnboredClientOptions } from './types';

export function applySettingDefaults(
  options: OnboredClientOptions = {},
  defaults: OnboredClientOptions = DEFAULT_GLOBAL_OPTIONS
) {
  const result = {
    ...defaults,
    ...options,
    storage: {
      ...defaults?.storage,
      ...options?.storage,
    },
    sessionReplay:
      options.sessionReplay === false
        ? false
        : {
            ...defaults?.sessionReplay,
            ...options?.sessionReplay,
          },
    global: {
      ...defaults?.global,
      ...options?.global,
      headers: {
        ...defaults.global?.headers,
        ...options.global?.headers,
      },
    },
  };

  return result;
}

export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function sanitize(input: string): string {
  return input.replace(/[<>"'`]/g, '');
}
