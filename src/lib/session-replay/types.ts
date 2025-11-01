export type MaskInputOptions = {
  password?: boolean;
  email?: boolean;
  tel?: boolean;
  number?: boolean;
  text?: boolean;
  textarea?: boolean;
  search?: boolean;
  url?: boolean;
  date?: boolean;
  color?: boolean;
};

export type SessionReplayOptions = {
  apiHost: string;
  flushInterval?: number | undefined;
  maskInputs?: boolean | undefined;
  maskInputOptions?: MaskInputOptions | undefined;
  blockElements?: string[] | undefined;
  privateSelectors?: string[] | undefined;
  onError?: ((err: Error) => void) | undefined;
  onReplayEvent?: (
    eventType: 'replay_started' | 'replay_stopped',
    data: {
      sessionId: string;
      accountId?: string;
      userId?: string;
      timestamp: string;
    }
  ) => void;
};

export type SessionReplayEvent = {
  type: number;
  data: unknown;
  timestamp: number;
};

export type SessionReplay = {
  events: SessionReplayEvent[];
  sessionId: string;
  projectKey: string;
  timestamp: number;
};

export type SessionReplayClientOptions = SessionReplayOptions & {
  sessionId: string;
  debug: boolean;
  accountId?: string;
  uploadUrl: string;
  userId?: string;
};
