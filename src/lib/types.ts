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
  accountId?: string;
  accountTraits?: Options;
  userId?: string;
  userTraits?: Options;
  debug?: boolean;
  env?: string;
  apiHost?: string;
  storage?: Storage;
  global?: {
    fetch?: Fetch;
    headers?: Record<string, string>;
  };
  sessionReplay?: false | SessionReplayOptions;
};

export type FlowContext = {
  id: string;
  startedAt: number;
  status?: 'started' | 'complete' | 'abandoned';
  lastVisitedPath?: string;
};

export type EventType =
  | 'page_viewed'
  | 'flow_started'
  | 'flow_completed'
  | 'step_viewed'
  | 'step_skipped'
  | 'step_abandoned'
  | 'step_completed'
  | 'replay_started'
  | 'replay_stopped';

export type EventPayload = {
  id: string;
  project_key: string;
  session_id: string;
  user_id?: string;
  account_id?: string;
  event_type: EventType;
  funnel_slug?: string;
  flow_id?: string;
  step_id?: string;
  metadata?: Options;
  timestamp: string; // ISO date in UTC
  timezone: string; // IANA timezone identifier
  timezone_offset: number; // Minutes from UTC
  url: string;
  referrer?: string | undefined;
  user_traits?: Options;
  account_traits?: Options;
};

export type RetryEvent = {
  payload: EventPayload[];
  attempt: number;
  nextAttemptAt: number;
};

export interface OnboredClientInterface {
  funnel(slug: string, metadata?: Options): Promise<void>;
  step(stepName: string, options: { slug: string } & Options): Promise<void>;
  skip(stepName: string, options: { slug: string } & Options): Promise<void>;
  complete(options: { slug: string } & Options): Promise<void>;
  capture(
    event_type: EventType,
    data: Partial<
      Omit<
        EventPayload,
        'id' | 'event_type' | 'session_id' | 'timestamp' | 'project_key'
      >
    >,
    enqueue?: boolean
  ): Promise<EventPayload | null>;
  reset(): void;
  destroy(): void;
  _getEvents(): EventPayload[];
  _getFlowContext(flowId: string): FlowContext | null;
  _getSessionId(): string;
  _getRecorder(): any;
  _getRecorderEvents(): any[];
}
