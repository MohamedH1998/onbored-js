export type SessionReplayOptions = {
  api_host: string;
  flush_interval?: number | undefined;
  mask_inputs?: boolean | undefined;
  block_elements?: string[] | undefined;
  on_error?: ((err: Error) => void) | undefined;
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
