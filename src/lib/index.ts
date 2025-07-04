import { OnboredClient } from "./client";
import { OnboredClientOptions } from "./types";

export function onboardClient(
  projectKey: string,
  options?: OnboredClientOptions
): OnboredClient {
  if (typeof window === "undefined") {
    throw new Error("OnboardClient can only be used in the browser");
  }

  return new OnboredClient(projectKey, options);
}
