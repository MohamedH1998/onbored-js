import { SessionReplayOptions } from "./session-replay/types";

export type UserMetadata = Record<string, any>;

export type Environment = "development" | "production";

export type Storage = {
  sessionStorageKey?: string;
  activityStorageKey?: string;
  flowContextStorageKey?: string;
};

export type Fetch = typeof fetch;

export type OnboredClientOptions = {
  user_id?: string;
  user_metadata?: UserMetadata;
  debug?: boolean;
  env?: Environment;
  api_host?: string;
  storage?: Storage;
  global?: {
    fetch?: Fetch;
    headers?: Record<string, string>;
  };
  session_replay?: false | SessionReplayOptions;
};

export type FlowContext = {
  id: string;
  startedAt: number;
  status?: "started" | "completed" | "abandoned";
  lastVisitedPath?: string;
};

// interface OnboredOptions {
//   userId?: string;
//   traits?: Record<string, any>;
//   debug?: boolean;
//   env?: "development" | "production";
// }

export interface EventPayload {
  eventType: string;
  slug?: string;
  flowId?: string;
  step?: string;
  options: Record<string, any>;
  result?: string;
  traits?: Record<string, any>;
  sessionId: string;
  timestamp: string;
  projectKey: string;
  url: string;
  referrer?: string;
}

// Internal types (not exported)
export type RetryEvent = {
  payload: EventPayload[];
  attempt: number;
  nextAttemptAt: number;
};
