import { SessionReplayOptions } from './session-replay/types';

export type Options = {
  [key: string]: string | number | boolean | null | Options | Options[];
};

export type Environment = 'development' | 'production';

export type Storage = {
  sessionStorageKey?: string;
  activityStorageKey?: string;
  flowContextStorageKey?: string;
};

export type Fetch = typeof fetch;

export type OnboredClientOptions = {
  user_id?: string;
  user_metadata?: Options;
  debug?: boolean;
  env?: string;
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
  status?: 'started' | 'completed' | 'abandoned';
  lastVisitedPath?: string;
};

export type EventType =
  | 'page_viewed'
  | 'flow_started'
  | 'flow_completed'
  | 'step_viewed'
  | 'step_skipped'
  | 'step_abandoned'
  | 'step_completed';

export type EventPayload = {
  id: string;
  event_type: EventType;
  funnel_slug?: string;
  flow_id?: string;
  step_id?: string;
  metadata?: Options;
  session_id: string;
  timestamp: string;
  project_key: string;
  url: string;
  referrer?: string | undefined;
};

export type RetryEvent = {
  payload: EventPayload[];
  attempt: number;
  nextAttemptAt: number;
};
