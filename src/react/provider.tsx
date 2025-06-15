"use client";

import React, { useEffect } from "react";

import onbored from "../onbored";

type OnBoredOptions = {
  userId?: string;
  traits?: Record<string, any>;
  debug?: boolean;
};

type WithChildren<T> = T & { children: React.ReactNode };

type OnBoredProviderProps =
  | { client: typeof onbored; projectKey?: never; options?: never }
  | { projectKey: string; options?: OnBoredOptions; client?: never };

export function OnBoredProvider({
  children,
  client,
  projectKey,
  options,
}: WithChildren<OnBoredProviderProps>) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (client) {
      // Already initialized externally
      return;
    }

    if (!projectKey) {
      console.warn("[OnBoredProvider] Missing projectKey");
      return;
    }

    if (!onbored) return;

    onbored.init(projectKey, options || {});
  }, [client, projectKey, options]);

  return <>{children}</>;
}
