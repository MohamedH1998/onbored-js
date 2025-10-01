/// <reference types="jest" />

// Jest matcher types
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidTimestamp(): R;
      toHaveBeenCalledWithEventType(eventType: string): R;
    }
  }
}

// Extend Jest's Expect interface for custom matchers
declare module 'expect' {
  interface Matchers<R> {
    toBeValidUUID(): R;
    toBeValidTimestamp(): R;
    toHaveBeenCalledWithEventType(eventType: string): R;
  }
}

export {}
