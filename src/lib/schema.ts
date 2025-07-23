import { z } from "zod";

export const eventPayloadSchema = z.object({
  id: z.string(),
  event_type: z.string(),
  flow_id: z.string().optional(),
  slug: z.string().optional(),
  step_id: z.string().optional(),
  options: z.record(z.any()).default({}),
  result: z.string().optional(),
  traits: z.record(z.any()).optional(),
  session_id: z.string().uuid(),
  timestamp: z.string(), // ISO date
  project_key: z.string(),
  url: z.string().url(),
  referrer: z.string().url().optional(),
});
