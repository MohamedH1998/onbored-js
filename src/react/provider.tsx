import React, { createContext, useContext, useEffect, useRef } from "react";
import { Onbored, OnboredConfig } from "../onbored";

type OnBoredContextValue = {
  client: Onbored | null;
  isInitialized: boolean;
};

const OnBoredContext = createContext<OnBoredContextValue>({
  client: null,
  isInitialized: false,
});

type OnBoredProviderProps = {
  config: OnboredConfig;
  children: React.ReactNode;
};

export function OnBoredProvider({
  children,
  config,
}: OnBoredProviderProps) {
  const clientRef = useRef<Onbored | null>(null);
  const [isInitialized, setIsInitialized] = React.useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      console.warn("[OnBoredProvider] No window object found");
      return;
    }

    if (!config.projectKey) {
      console.warn("[OnBoredProvider] Missing projectKey in config");
      return;
    }

    try {
      // Create new instance
      const client = new Onbored(config);
      clientRef.current = client;
      setIsInitialized(true);
      
      console.log("[OnBoredProvider] Initialized with", { 
        projectKey: config.projectKey, 
        debug: config.debug 
      });
    } catch (error) {
      console.error("[OnBoredProvider] Failed to initialize:", error);
    }

    // Cleanup on unmount
    return () => {
      if (clientRef.current) {
        clientRef.current.destroy();
        clientRef.current = null;
        setIsInitialized(false);
      }
    };
  }, [config.projectKey]); // Only recreate if projectKey changes

  const contextValue: OnBoredContextValue = {
    client: clientRef.current,
    isInitialized,
  };

  return (
    <OnBoredContext.Provider value={contextValue}>
      {children}
    </OnBoredContext.Provider>
  );
}

// Hook to access the Onbored client
export function useOnbored() {
  const context = useContext(OnBoredContext);
  
  if (context === undefined) {
    throw new Error("useOnbored must be used within an OnBoredProvider");
  }
  
  return context;
}
