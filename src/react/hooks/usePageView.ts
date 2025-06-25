import { useEffect } from "react";
import { useOnbored } from "../provider";

type PageViewOptions = {
  path?: string;
  title?: string;
  funnelSlug?: string;
  additionalData?: Record<string, any>;
};

export function usePageView(options: PageViewOptions = {}) {
  const { client, isInitialized } = useOnbored();

  useEffect(() => {
    if (typeof window === "undefined" || !client || !isInitialized) return;

    try {
      const path = options.path || window.location.pathname;
      const title = options.title || document.title;

      client.capture("Page View", {
        options: {
          path,
          title,
          ...(options.funnelSlug && { funnelSlug: options.funnelSlug }),
          ...options.additionalData,
        },
      });
    } catch (error) {
      console.error("[usePageView] Failed to track page view:", error);
    }
  }, [client, isInitialized, options.path, options.title, options.funnelSlug]);
}
