// constants.ts
import { version } from "./version";

let JS_ENV = "";
// @ts-ignore
if (typeof Deno !== "undefined") {
  JS_ENV = "deno";
} else if (typeof document !== "undefined") {
  JS_ENV = "web";
} else if (
  typeof navigator !== "undefined" &&
  navigator.product === "ReactNative"
) {
  JS_ENV = "react-native";
} else {
  JS_ENV = "node";
}

export const DEFAULT_HEADERS = {
  "X-Client-Info": `onbored-js-${JS_ENV}/${version}`,
  "Content-Type": "application/json",
};

export const DEFAULT_GLOBAL_OPTIONS = {
  headers: DEFAULT_HEADERS,
  intervals: {
    retry: 5000, // 5 seconds
  },
  session_replay: {
    // TODO: update api_host to use real api
    api_host: "https://api.onbored.com",
    flush_interval: 10000,
    mask_inputs: true,
    block_elements: [],
    on_error: (err: Error) => {
      console.error("Session replay error:", err);
    },
  },
};
