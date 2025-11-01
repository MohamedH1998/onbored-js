import { SessionReplayClient } from './client';
import { SessionReplayClientOptions } from './types';

export async function createSessionReplay(
  projectKey: string,
  options: SessionReplayClientOptions
): Promise<SessionReplayClient> {
  const recorder = new SessionReplayClient(projectKey, options);
  await recorder.start();
  return recorder;
}
