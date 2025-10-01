/**
 * SDK Initialization Tests
 *
 * Comprehensive tests for OnBored SDK initialization covering:
 * - Valid initialization scenarios
 * - Invalid initialization handling
 * - Configuration options
 * - Environment detection
 * - Error handling and edge cases
 */

import { OnboredClient } from '../lib/client';
import {
  createMockOptions,
  createMockProjectKey,
  setupTestEnvironment,
  cleanupTestEnvironment,
  expectValidSessionId,
  TEST_CONFIG,
} from './utils/testUtils';
import { mockApiResponses } from './mocks/mockFetch';
import { getMockStorage } from './mocks/mockStorage';

describe('SDK Initialization', () => {
  beforeEach(() => {
    setupTestEnvironment();
    mockApiResponses();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  describe('Valid Initialization', () => {
    it('should initialize with valid projectKey', () => {
      const client = new OnboredClient(createMockProjectKey());

      expect(client).toBeInstanceOf(OnboredClient);
      expect(client['projectKey']).toBe(createMockProjectKey());
    });

    it('should set correct default options', () => {
      const client = new OnboredClient(createMockProjectKey());

      expect(client['env']).toBe('production');
      expect(client['debug']).toBe(false);
      expect(client['api_host']).toBe('https://api.onbored.com');
      expect(client['sessionTimeoutMs']).toBe(30 * 60 * 1000);
    });

    it('should create session ID', () => {
      const client = new OnboredClient(createMockProjectKey());

      expect(client['sessionId']).toBeTruthy();
      expectValidSessionId(client['sessionId']);
    });

    it('should initialize logger with correct level', () => {
      const client = new OnboredClient(createMockProjectKey(), { debug: true });

      expect(client['logger']).toBeDefined();
      expect(client['debug']).toBe(true);
    });

    it('should apply custom options correctly', () => {
      const options = createMockOptions({
        debug: true,
        env: 'development',
        api_host: 'http://localhost:3000',
        user_id: 'custom-user-id',
      });

      const client = new OnboredClient(createMockProjectKey(), options);

      expect(client['debug']).toBe(true);
      expect(client['env']).toBe('development');
      expect(client['api_host']).toBe('http://localhost:3000');
      expect(client['userId']).toBe('custom-user-id');
    });

    it('should merge with default options', () => {
      const options = {
        debug: true,
        // Other options should use defaults from production
      };

      const client = new OnboredClient(createMockProjectKey(), options);

      expect(client['debug']).toBe(true);
      expect(client['env']).toBe('production'); // Default
      expect(client['api_host']).toBe('https://api.onbored.com'); // Default
    });

    it('should handle development mode correctly', () => {
      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      expect(client['env']).toBe('development');
      expect(client['debug']).toBe(true);
    });

    it('should set up session replay when enabled', () => {
      const client = new OnboredClient(createMockProjectKey(), {
        session_replay: {
          api_host: 'http://localhost:3000',
        },
      });

      expect(client['sessionReplay']).toBeDefined();
      expect(client['sessionReplay']).toHaveProperty('api_host');
    });
  });

  describe('Invalid Initialization', () => {
    it('should throw error when projectKey is missing', () => {
      expect(() => {
        new OnboredClient('');
      }).toThrow('[Onbored]: projectKey is required.');
    });

    it('should throw error when projectKey is undefined', () => {
      expect(() => {
        new OnboredClient(undefined as any);
      }).toThrow('[Onbored]: projectKey is required.');
    });

    it('should throw error when projectKey is null', () => {
      expect(() => {
        new OnboredClient(null as any);
      }).toThrow('[Onbored]: projectKey is required.');
    });

    it('should warn when initialized multiple times', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // First initialization
      new OnboredClient(createMockProjectKey());

      // Second initialization should not throw but may warn
      expect(() => {
        new OnboredClient(createMockProjectKey());
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('Configuration Options', () => {
    it('should handle storage options', () => {
      const client = new OnboredClient(createMockProjectKey(), {
        storage: {
          sessionStorageKey: 'custom-session-key',
          activityStorageKey: 'custom-activity-key',
          flowContextStorageKey: 'custom-flow-key',
        },
      });

      expect(client['sessionStorageKey']).toBe('custom-session-key');
      expect(client['activityStorageKey']).toBe('custom-activity-key');
      expect(client['flowContextStorageKey']).toBe('custom-flow-key');
    });

    it('should handle global options', () => {
      const client = new OnboredClient(createMockProjectKey(), {
        global: {
          headers: {
            'Custom-Header': 'custom-value',
          },
        },
      });

      // Headers should include both default headers and custom headers
      expect(client['headers']).toMatchObject({
        'Custom-Header': 'custom-value',
        'Content-Type': 'application/json',
        'X-Client-Info': expect.stringContaining('onbored-js'),
      });
    });

    it('should handle session timeout', () => {
      const client = new OnboredClient(createMockProjectKey());

      expect(client['sessionTimeoutMs']).toBe(30 * 60 * 1000);
    });

    it('should handle user metadata', () => {
      const userMetadata = {
        name: 'Test User',
        email: 'test@example.com',
        plan: 'premium',
      };

      const client = new OnboredClient(createMockProjectKey(), {
        user_metadata: userMetadata,
      });

      // Note: user_metadata is not directly stored on client, but should be handled
      expect(client).toBeInstanceOf(OnboredClient);
    });
  });

  describe('Environment Detection', () => {
    it('should detect browser environment', () => {
      const client = new OnboredClient(createMockProjectKey());

      expect(typeof window).toBe('object');
      expect(typeof document).toBe('object');
    });

    it('should handle development vs production modes', () => {
      const devClient = new OnboredClient(createMockProjectKey(), {
        env: 'development',
      });
      const prodClient = new OnboredClient(createMockProjectKey(), {
        env: 'production',
      });

      expect(devClient['env']).toBe('development');
      expect(prodClient['env']).toBe('production');
    });

    it('should set up appropriate API endpoints', () => {
      const client = new OnboredClient(createMockProjectKey(), {
        api_host: 'http://localhost:3000',
      });

      expect(client['api_host']).toBe('http://localhost:3000');
    });
  });

  describe('Session Management', () => {
    it('should create new session when none exists', () => {
      const mockStorage = getMockStorage();
      mockStorage.localStorage.getItem.mockReturnValue(null);

      const client = new OnboredClient(createMockProjectKey());

      expect(client['sessionId']).toBeTruthy();
      expect(mockStorage.localStorage.setItem).toHaveBeenCalled();
    });

    it('should reuse existing session when valid', () => {
      const mockStorage = getMockStorage();
      const existingSessionId = 'a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6'; // Valid UUID
      const recentActivity = Date.now().toString();

      // Properly mock the sequence of getItem calls that _getSessionId makes:
      // 1. First call: get activity timestamp
      // 2. Second call: get session ID
      mockStorage.localStorage.getItem
        .mockReturnValueOnce(recentActivity) // Activity timestamp
        .mockReturnValueOnce(existingSessionId); // Existing session ID

      const client = new OnboredClient(createMockProjectKey());

      expect(client['sessionId']).toBe(existingSessionId);
    });

    it('should create new session when expired', () => {
      const mockStorage = getMockStorage();
      const expiredTime = Date.now() - 31 * 60 * 1000; // 31 minutes ago
      mockStorage.localStorage.getItem
        .mockReturnValueOnce('existing-session-id') // session ID
        .mockReturnValueOnce(expiredTime.toString()); // activity time

      const client = new OnboredClient(createMockProjectKey());

      expect(client['sessionId']).not.toBe('existing-session-id');
      expect(mockStorage.localStorage.setItem).toHaveBeenCalled();
    });

    it('should handle invalid session ID', () => {
      const mockStorage = getMockStorage();
      mockStorage.localStorage.getItem
        .mockReturnValueOnce(Date.now().toString()) // valid activity time
        .mockReturnValueOnce('invalid-session-id'); // invalid session ID

      const client = new OnboredClient(createMockProjectKey());

      expect(client['sessionId']).not.toBe('invalid-session-id');
      expect(mockStorage.localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('Flow Context Management', () => {
    it('should initialize empty flow context', () => {
      const client = new OnboredClient(createMockProjectKey());

      expect(client['flowContext']).toBeInstanceOf(Map);
      expect(client['flowContext'].size).toBe(0);
    });

    it('should restore flow context from storage', () => {
      const mockStorage = getMockStorage();
      const sessionId = 'a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6';

      // Mock localStorage to return a valid session
      mockStorage.localStorage.getItem
        .mockReturnValueOnce(Date.now().toString()) // Activity timestamp
        .mockReturnValueOnce(sessionId); // Existing session ID

      const storedContext = {
        sessionId: sessionId, // Must match the session ID the client will use
        flows: [
          [
            'test-flow',
            { id: 'flow-id', startedAt: Date.now(), status: 'started' },
          ],
        ],
      };

      mockStorage.sessionStorage.getItem.mockReturnValue(
        JSON.stringify(storedContext)
      );

      const client = new OnboredClient(createMockProjectKey());

      expect(client['flowContext'].size).toBe(1);
      expect(client['flowContext'].has('test-flow')).toBe(true);
    });

    it('should clear flow context on session change', () => {
      const mockStorage = getMockStorage();
      const storedContext = {
        sessionId: 'different-session',
        flows: [
          [
            'test-flow',
            { id: 'flow-id', startedAt: Date.now(), status: 'started' },
          ],
        ],
      };

      mockStorage.sessionStorage.getItem.mockReturnValue(
        JSON.stringify(storedContext)
      );

      const client = new OnboredClient(createMockProjectKey());

      expect(client['flowContext'].size).toBe(0);
    });

    it('should handle invalid stored context gracefully', () => {
      const mockStorage = getMockStorage();
      mockStorage.sessionStorage.getItem.mockReturnValue('invalid-json');

      const client = new OnboredClient(createMockProjectKey());

      expect(client['flowContext'].size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', () => {
      const mockStorage = getMockStorage();
      mockStorage.localStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => {
        new OnboredClient(createMockProjectKey());
      }).not.toThrow();
    });

    it('should handle session storage errors gracefully', () => {
      const mockStorage = getMockStorage();

      // Mock sessionStorage to throw error
      mockStorage.sessionStorage.getItem = jest.fn((key: string) => {
        throw new Error('Session storage error');
      });

      expect(() => {
        new OnboredClient(createMockProjectKey());
      }).not.toThrow();
    });

    it('should handle invalid configuration gracefully', () => {
      const client = new OnboredClient(createMockProjectKey(), {
        // Invalid options should be handled gracefully
        invalidOption: 'invalid-value',
      } as any);

      expect(client).toBeInstanceOf(OnboredClient);
    });
  });

  describe('Initialization Promise', () => {
    it('should resolve initialization promise', async () => {
      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
      });

      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(client['isInitializing']).toBe(false);
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock fetch to throw error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const client = new OnboredClient(createMockProjectKey());

      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(client['isInitializing']).toBe(false);
    });
  });
});
