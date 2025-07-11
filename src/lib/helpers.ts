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
    session_replay:
      options.session_replay === false
        ? false
        : {
            ...defaults?.session_replay,
            ...options?.session_replay,
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

export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function sanitize(input: string): string {
  return input.replace(/[<>"'`]/g, "");
}
