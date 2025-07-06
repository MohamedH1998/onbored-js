import { z } from "zod";

export const eventPayloadSchema = z.object({
  eventType: z.string(),
  flowId: z.string().optional(),
  slug: z.string().optional(),
  step: z.string().optional(),
  options: z.record(z.any()).default({}),
  result: z.string().optional(),
  traits: z.record(z.any()).optional(),
  sessionId: z.string().uuid(),
  timestamp: z.string(), // ISO date
  projectKey: z.string(),
  url: z.string().url(),
  referrer: z.string().url().optional(),
});
