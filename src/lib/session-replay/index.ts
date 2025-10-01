import { SessionReplayClient } from './client';
import { SessionReplayOptions } from './types';

export async function createSessionReplay(
  projectKey: string,
  options: SessionReplayOptions & { sessionId: string; debug: boolean }
): Promise<SessionReplayClient> {
  const recorder = new SessionReplayClient(projectKey, options);
  await recorder.start();
  return recorder;
}
