import { OnboredClientOptions } from "./types";

export function applySettingDefaults(
  options: OnboredClientOptions = {},
  defaults: OnboredClientOptions = {}
) {
  const result = {
    ...defaults,
    ...options,
    storage: {
      ...options?.storage,
      ...defaults?.storage,
    },
    global: {
      ...options?.global,
      ...defaults?.global,
      headers: {
        ...options.global?.headers,
        ...defaults.global?.headers,
      },
    },
  };

  return result;
}
