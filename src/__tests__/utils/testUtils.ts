/**
 * Test Utilities
 *
 * Comprehensive test utilities for OnBored SDK testing:
 * - Test data factories
 * - Assertion helpers
 * - Mock configurations
 * - Test environment setup
 */

import { OnboredClientOptions } from '../../lib/types';

// Test data factories
export const createMockProjectKey = () => 'test-project-key-12345';
export const createMockUserId = () => 'test-user-12345';
export const createMockSessionId = () => 'test-session-12345';

export const createMockOptions = (
  overrides: Partial<OnboredClientOptions> = {}
): OnboredClientOptions => ({
  user_id: createMockUserId(),
  debug: true,
  env: 'development',
  api_host: 'http://localhost:3000',
  ...overrides,
});

export const createMockEventPayload = (overrides: any = {}) => ({
  id: 'test-event-12345',
  event_type: 'test_event',
  session_id: createMockSessionId(),
  timestamp: new Date().toISOString(),
  project_key: createMockProjectKey(),
  url: 'http://localhost:3000',
  ...overrides,
});

export const createMockFlowContext = (overrides: any = {}) => ({
  id: 'test-flow-12345',
  startedAt: Date.now(),
  status: 'started' as const,
  ...overrides,
});

// Test environment helpers
export const setupTestEnvironment = () => {
  // Set up DOM
  document.body.innerHTML = '';
  document.head.innerHTML = '';

  // Note: window.location and navigator are already mocked in setup.ts
  // No need to redefine them here
};

export const cleanupTestEnvironment = () => {
  // Clear DOM
  document.body.innerHTML = '';
  document.head.innerHTML = '';

  // Clear storage
  localStorage.clear();
  sessionStorage.clear();

  // Clear timers
  jest.clearAllTimers();

  // Clear mocks
  jest.clearAllMocks();
};

// Assertion helpers
export const expectValidEventPayload = (payload: any) => {
  expect(payload).toHaveProperty('id');
  expect(payload).toHaveProperty('event_type');
  expect(payload).toHaveProperty('session_id');
  expect(payload).toHaveProperty('timestamp');
  expect(payload).toHaveProperty('project_key');

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  expect(payload.id).toMatch(uuidRegex);

  // Validate timestamp
  const date = new Date(payload.timestamp);
  expect(date.getTime()).toBeGreaterThan(0);
  expect(isNaN(date.getTime())).toBe(false);
};

export const expectValidFlowContext = (context: any) => {
  expect(context).toHaveProperty('id');
  expect(context).toHaveProperty('startedAt');
  expect(context).toHaveProperty('status');
  expect(typeof context.startedAt).toBe('number');
  expect(['started', 'completed']).toContain(context.status);
};

export const expectValidSessionId = (sessionId: string) => {
  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  expect(sessionId).toMatch(uuidRegex);
  expect(sessionId).toBeTruthy();
};

// Mock configuration helpers
export const configureMockFetch = (responses: Record<string, any> = {}) => {
  const mockFetch = jest.fn();

  Object.entries(responses).forEach(([url, response]) => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(response),
    });
  });

  global.fetch = mockFetch;
  return mockFetch;
};

export const configureMockStorage = () => {
  const mockStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    key: jest.fn(),
    length: 0,
  };

  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true,
  });

  Object.defineProperty(window, 'sessionStorage', {
    value: mockStorage,
    writable: true,
  });

  return mockStorage;
};

// Test data generators
export const generateMockEvents = (count: number) => {
  return Array.from({ length: count }, (_, i) =>
    createMockEventPayload({
      id: `event-${i}`,
      event_type: `test_event_${i}`,
    })
  );
};

export const generateMockFlows = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    slug: `flow-${i}`,
    context: createMockFlowContext({
      id: `flow-${i}-context`,
    }),
  }));
};

// Wait helpers
export const waitFor = (callback: () => boolean, timeout = 1000) => {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      if (callback()) {
        resolve();
      } else if (Date.now() - start > timeout) {
        reject(new Error('Timeout waiting for condition'));
      } else {
        setTimeout(check, 10);
      }
    };

    check();
  });
};

export const waitForAsync = async (
  callback: () => Promise<boolean>,
  timeout = 1000
) => {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await callback()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  throw new Error('Timeout waiting for async condition');
};

// DOM helpers
export const createTestElement = (
  tag: string,
  attributes: Record<string, string> = {}
) => {
  const element = document.createElement(tag);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
};

export const addTestElement = (element: HTMLElement) => {
  document.body.appendChild(element);
  return element;
};

export const removeTestElement = (element: HTMLElement) => {
  element.remove();
};

// Event simulation helpers
export const simulateClick = (element: HTMLElement) => {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
};

export const simulateScroll = (element: HTMLElement, scrollTop: number) => {
  element.scrollTop = scrollTop;
  const event = new Event('scroll', {
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
};

export const simulateResize = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    writable: true,
  });
  Object.defineProperty(window, 'innerHeight', {
    value: height,
    writable: true,
  });

  const event = new Event('resize', {
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
};

// Test configuration
export const TEST_CONFIG = {
  PROJECT_KEY: 'test-project-key',
  USER_ID: 'test-user-id',
  SESSION_ID: 'test-session-id',
  API_HOST: 'http://localhost:3000',
  TIMEOUT: 5000,
  RETRY_ATTEMPTS: 3,
} as const;

// Test constants
export const TEST_EVENTS = {
  FLOW_STARTED: 'flow_started',
  FLOW_COMPLETED: 'flow_completed',
  STEP_VIEWED: 'step_viewed',
  STEP_COMPLETED: 'step_completed',
  STEP_ABANDONED: 'step_abandoned',
  PAGE_VIEWED: 'page_viewed',
} as const;

export const TEST_FLOWS = {
  ONBOARDING: 'onboarding',
  CHECKOUT: 'checkout',
  SIGNUP: 'signup',
} as const;

export const TEST_STEPS = {
  WELCOME: 'welcome',
  FORM: 'form',
  CONFIRMATION: 'confirmation',
} as const;
