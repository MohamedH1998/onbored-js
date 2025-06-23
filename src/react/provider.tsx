import React, { useEffect } from "react";
import onbored from "../onbored";

type OnBoredOptions = {
  userId?: string;
  traits?: Record<string, any>;
  debug?: boolean;
};

type OnBoredProviderProps = {
  client?: typeof onbored;
  projectKey?: string;
  options?: OnBoredOptions;
  children: React.ReactNode;
};

export function OnBoredProvider({
  children,
  client,
  projectKey,
  options,
}: OnBoredProviderProps) {
  useEffect(() => {
    if (typeof window === "undefined") {
      console.warn("[OnBoredProvider] No window object found");
      return;
    }

    if (client) {
      console.log("[OnBoredProvider] Using external client");
      return;
    }

    if (!projectKey) {
      console.warn("[OnBoredProvider] Missing projectKey");
      return;
    }

    onbored.init(projectKey, options || {});
    console.log("[OnBoredProvider] Initialized with", { projectKey, options });
  }, [client, projectKey, options]);

  return <>{children}</>;
}
