export type SessionReplayOptions = {
  apiHost: string;
  flushInterval?: number | undefined;
  maskInputs?: boolean | undefined;
  blockElements?: string[] | undefined;
  onError?: ((err: Error) => void) | undefined;
};

export type SessionReplayEvent = {
  type: number;
  // @TODO: add type
  data: any;
  timestamp: number;
};

export type SessionReplay = {
  events: SessionReplayEvent[];
  sessionId: string;
  projectKey: string;
  timestamp: number;
};
