'use client';
import React, { useEffect } from 'react';
import { onbored } from '../lib';
import type { OnboredClientOptions } from '../lib/types';

interface OnboredProviderProps {
  children: React.ReactNode;
  config: {
    projectKey: string;
  } & OnboredClientOptions;
}

export function OnboredProvider({ children, config }: OnboredProviderProps) {
  useEffect(() => {
    if (!config) {
      console.warn('[OnboredProvider] Failed to initialize:', new Error('Config is required'));
      return;
    }

    try {
      onbored.init(config);
    } catch (err) {
      console.warn('[OnboredProvider] Failed to initialize:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.projectKey]);

  return <>{children}</>;
}
