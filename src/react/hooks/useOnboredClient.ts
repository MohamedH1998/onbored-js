import { useOnbored } from "../provider";

export function useOnboredClient() {
  const { client, isInitialized } = useOnbored();
  
  return {
    client,
    isInitialized,
    isReady: !!client && isInitialized,
    
    // Convenience methods
    capture: (eventType: string, data: any) => {
      if (!client) {
        console.warn("[useOnboredClient] Client not initialized");
        return null;
      }
      return client.capture(eventType, data);
    },
    
    context: (traits: Record<string, any>) => {
      if (!client) {
        console.warn("[useOnboredClient] Client not initialized");
        return;
      }
      client.context(traits);
    },
    
    reset: () => {
      if (!client) {
        console.warn("[useOnboredClient] Client not initialized");
        return;
      }
      client.reset();
    },
    
    flush: () => {
      if (!client) {
        console.warn("[useOnboredClient] Client not initialized");
        return;
      }
      // Note: flush is private, but we can trigger it via the global function
      const flushKey = `__onboredFlush_${client['projectKey']}`;
      if (typeof window !== "undefined" && (window as any)[flushKey]) {
        (window as any)[flushKey]();
      }
    }
  };
} 