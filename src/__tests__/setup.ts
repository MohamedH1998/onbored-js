/**
 * Jest Test Setup
 *
 * This file configures the test environment with:
 * - Testing Library matchers
 * - Global mocks for browser APIs
 * - Test utilities and helpers
 * - Cleanup between tests
 */

// Note: Polyfills (fetch, TextEncoder, etc.) are set up in jest-environment-with-fetch.js
// This ensures they're available before MSW loads

import '@testing-library/jest-dom';
import { mockStorage } from './mocks/mockStorage';
import {
  mockFetch,
  resetMockHandlers,
  closeMockServer,
} from './mocks/mockFetch';
import { mockBrowserAPIs } from './mocks/mockBrowserAPIs';
import { mockRRWeb } from './mocks/mockRRWeb';
import { mockUUID } from './mocks/mockUUID';

// Global test setup
beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();

  // Setup browser environment mocks
  mockStorage();
  mockFetch();
  mockBrowserAPIs();
  mockRRWeb();
  mockUUID();

  // Clear any existing timers
  jest.clearAllTimers();

  // Reset DOM
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

afterEach(() => {
  // Cleanup after each test
  jest.clearAllTimers();
  jest.restoreAllMocks();

  // Reset MSW handlers
  resetMockHandlers();

  // Clear any global state
  delete window.__onboredFlush;
  delete window.onbored;
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);

  // Close MSW server
  closeMockServer();
});

// Global test utilities
declare global {
  interface Window {
    __onboredFlush?: unknown;
    onbored?: unknown;
  }
}

// Jest matcher types are defined in jest-matchers.d.ts

// Custom Jest matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);

    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
      pass,
    };
  },

  toBeValidTimestamp(received: string) {
    const date = new Date(received);
    const pass = !isNaN(date.getTime()) && date.getTime() > 0;

    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid timestamp`,
      pass,
    };
  },

  toHaveBeenCalledWithEventType(received: jest.Mock, eventType: string) {
    const calls = received.mock.calls;
    const pass = calls.some(
      (call: unknown[]) =>
        call[0] &&
        typeof call[0] === 'object' &&
        call[0] !== null &&
        'event_type' in call[0] &&
        (call[0] as { event_type: string }).event_type === eventType
    );

    return {
      message: () =>
        `expected mock ${pass ? 'not ' : ''}to have been called with event type ${eventType}`,
      pass,
    };
  },
});

// Mock console methods in tests to reduce noise
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console logs in tests unless explicitly enabled
  if (!process.env.DEBUG_TESTS) {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

// Mock window history (needs to be mocked for tests)
Object.defineProperty(window, 'history', {
  value: {
    pushState: jest.fn(),
    replaceState: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    go: jest.fn(),
    length: 1,
    state: null,
  },
  writable: true,
  configurable: true,
});

// Mock IntersectionObserver
globalThis.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock MutationObserver
globalThis.MutationObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: jest.fn(() => '08d353e5-cb8d-4bee-89c0-6a4af6519f03'),
    getRandomValues: jest.fn(array => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }),
  },
  writable: true,
  configurable: true,
});

// Mock navigator - extend with sendBeacon
if (!globalThis.navigator.sendBeacon) {
  Object.defineProperty(globalThis.navigator, 'sendBeacon', {
    value: jest.fn().mockReturnValue(true),
    writable: true,
    configurable: true,
  });
}
