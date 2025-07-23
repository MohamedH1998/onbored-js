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

export type EventType =
  | string
  | "page_viewed"
  | "flow_started"
  | "flow_completed"
  | "step_viewed"
  | "step_skipped"
  | "step_abandoned"
  | "step_completed";

export interface EventPayload {
  id: string;
  event_type: EventType;
  slug?: string;
  flow_id?: string;
  step_id?: string;
  options: Record<string, any>;
  result?: string;
  traits?: Record<string, any>;
  session_id: string;
  timestamp: string;
  project_key: string;
  url: string;
  referrer?: string;
}

// Internal types (not exported)
export type RetryEvent = {
  payload: EventPayload[];
  attempt: number;
  nextAttemptAt: number;
};
