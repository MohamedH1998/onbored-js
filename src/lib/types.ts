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
  userId?: string;
  userMetadata?: Options;
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
  | 'flow_complete'
  | 'step_viewed'
  | 'step_skipped'
  | 'step_abandoned'
  | 'step_complete';

export type EventPayload = {
  id: string;
  event_type: EventType;
  funnel_slug?: string;
  flow_id?: string;
  step_id?: string;
  metadata?: Options;
  session_id: string;
  sessionId?: string; // Backwards compatibility
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
