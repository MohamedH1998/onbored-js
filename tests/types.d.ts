/* eslint-disable no-unused-vars */

import { OnboredClientInterface, OnboredClientOptions } from '../src/lib/types';

declare global {
  interface Window {
    onbored: OnboredClientInterface & {
      init: (config: { projectKey: string } & OnboredClientOptions) => void;
    };
  }
}

export {};
