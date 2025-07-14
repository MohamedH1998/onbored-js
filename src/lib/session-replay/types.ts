export type SessionReplayOptions = {
    api_host: string;
    flush_interval?: number;
    mask_inputs?: boolean;
    block_elements?: string[];
    on_error?: (err: Error) => void;
  };
  
  export type SessionReplayEvent = {
    type: number;
    data: any;
    timestamp: number;
  };
  
  export type SessionReplay = {
    events: SessionReplayEvent[];
    sessionId: string;
    projectKey: string;
    timestamp: number;
  };