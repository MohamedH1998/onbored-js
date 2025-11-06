'use client';
import React, { useEffect, useState } from 'react';
import { onbored } from '../lib';
import type { OnboredClientOptions } from '../lib/types';
import { Logger } from '../lib/logger';

interface OnboredProviderProps {
  children: React.ReactNode;
  config: {
    projectKey: string;
  } & OnboredClientOptions;
}

export function OnboredProvider({ children, config }: OnboredProviderProps) {
  const [prevConfig, setPrevConfig] = useState<typeof config>();
  const [isInitialized, setIsInitialized] = useState(false);
  const logger = new Logger('[Onbored]', config?.debug ? 'debug' : 'info');

  if (config !== prevConfig) {
    setPrevConfig(config);
    if (isInitialized && prevConfig) {
      try {
        if (config.accountId && config.accountId !== prevConfig.accountId) {
          onbored.identifyAccount(config.accountId, config.accountTraits || {});
        }
        if (config.userId && config.userId !== prevConfig.userId) {
          onbored.identify(config.userId, config.userTraits || {});
        }
      } catch (err) {
        logger.error('Failed to update identification:', err);
      }
    }
  }
  useEffect(() => {
    if (!config) {
      logger.warn('Failed to initialize: config is required');
      return;
    }
    if (!isInitialized) {
      try {
        onbored.init(config);
        setIsInitialized(true);
      } catch (err) {
        console.warn('[OnboredProvider] Failed to initialize:', err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, isInitialized]);

  return <>{children}</>;
}
