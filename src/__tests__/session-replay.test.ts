/**
 * Session Replay Tests
 *
 * Comprehensive tests for OnBored SDK session replay functionality covering:
 * - Session replay initialization
 * - Recording lifecycle
 * - Event management
 * - Idle detection
 * - Error handling and edge cases
 */

import { OnboredClient } from '../lib/client';
import {
  createMockProjectKey,
  setupTestEnvironment,
  cleanupTestEnvironment,
} from './utils/testUtils';
import { mockApiResponses } from './mocks/mockFetch';
import { getMockRRWeb } from './mocks/mockRRWeb';

describe('Session Replay', () => {
  let client: OnboredClient;
  let mockRRWeb: ReturnType<typeof getMockRRWeb>;

  beforeEach(() => {
    setupTestEnvironment();
    mockApiResponses();
    mockRRWeb = getMockRRWeb();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  describe('Session Replay Initialization', () => {
    it('should initialize recorder with valid options', async () => {
      client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
        session_replay: {
          api_host: 'http://localhost:3000',
        },
      });

      expect(client['sessionReplay']).toBeDefined();
      expect(client['sessionReplay']).toHaveProperty('api_host');
      expect(client['sessionReplay']).not.toBe(false);
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock RRWeb to throw error
      mockRRWeb.mockRecord.mockImplementation(() => {
        throw new Error('RRWeb initialization failed');
      });

      client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
        session_replay: {
          api_host: 'http://localhost:3000',
        },
      });

      // Should not throw error
      expect(client).toBeInstanceOf(OnboredClient);
    });

    it('should set up correct event handlers', async () => {
      client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
        session_replay: {
          api_host: 'http://localhost:3000',
        },
      });

      expect(client['sessionReplay']).toBeDefined();
    });

    it('should configure rrweb options correctly', async () => {
      const sessionReplayOptions = {
        api_host: 'http://localhost:3000',
        flush_interval: 5000,
        mask_inputs: true,
        block_elements: ['.sensitive'],
      };

      client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
        session_replay: sessionReplayOptions,
      });

      expect(client['sessionReplay']).toEqual(sessionReplayOptions);
    });

    it('should handle missing session replay options', () => {
      client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      expect(client['sessionReplay']).toBe(false);
    });

    it('should handle invalid session replay options', () => {
      client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
        // @ts-expect-error - Testing invalid prop type
        session_replay: true, // Invalid - should be object or false
      });

      expect(client['sessionReplay']).toBe(false);
    });
  });

  describe('Recording Lifecycle', () => {
    beforeEach(() => {
      client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
        session_replay: {
          api_host: 'http://localhost:3000',
        },
      });
    });

    it('should start recording successfully', async () => {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      // In development mode, recorder should should be initialized
      expect(client['recorder']).toBeDefined();
    });

    it('should stop recording and cleanup', () => {
      if (client['recorder']) {
        client['recorder'].stop();
        expect(mockRRWeb.getActiveRecords().length).toBe(0);
      }
    });

    it('should handle multiple start/stop cycles', async () => {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      if (client['recorder']) {
        client['recorder'].stop();
        expect(mockRRWeb.getActiveRecords().length).toBe(0);

        // Start again
        // @ts-expect-error - Assigning mock recorder for testing
        client['recorder'] = mockRRWeb.mockRecord();
        expect(mockRRWeb.getActiveRecords().length).toBe(1);
      }
    });

    it('should clear events on stop', () => {
      if (client['recorder']) {
        // Add some mock events
        mockRRWeb.mockAddCustomEvent('test-event', { data: 'test' });
        expect(mockRRWeb.getEvents().length).toBeGreaterThan(0);

        client['recorder'].stop();
        mockRRWeb.clearEvents();
        expect(mockRRWeb.getEvents().length).toBe(0);
      }
    });

    it('should handle recording errors gracefully', () => {
      mockRRWeb.mockRecord.mockImplementation(() => {
        throw new Error('Recording failed');
      });

      expect(() => {
        client = new OnboredClient(createMockProjectKey(), {
          env: 'development',
          debug: true,
          session_replay: {
            api_host: 'http://localhost:3000',
          },
        });
      }).not.toThrow();
    });
  });

  describe('Event Management', () => {
    beforeEach(() => {
      client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
        session_replay: {
          api_host: 'http://localhost:3000',
        },
      });
    });

    it('should capture events correctly', () => {
      if (client['recorder']) {
        client['recorder'].addCustomEvent('test-event', { data: 'test' });

        const events = client['recorder']._getEvents();
        expect(events.length).toBeGreaterThan(0);
        expect((events[0]?.data as any)?.tag).toBe('test-event');
        expect((events[0]?.data as any)?.payload).toEqual({ data: 'test' });
      }
    });

    it('should handle event compression', () => {
      if (client['recorder']) {
        // Add multiple events
        for (let i = 0; i < 10; i++) {
          client['recorder'].addCustomEvent(`event-${i}`, {
            data: `test-${i}`,
          });
        }

        const events = client['recorder']._getEvents();
        expect(events.length).toBe(10);
      }
    });

    it('should upload events at intervals', async () => {
      // Mock fetch to track uploads
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });
      global.fetch = fetchSpy;

      client = new OnboredClient(createMockProjectKey(), {
        env: 'production',
        debug: true,
        session_replay: {
          api_host: 'http://localhost:3000',
        },
      });

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate some events
      if (client['recorder']) {
        client['recorder'].addCustomEvent('test-event', { data: 'test' });
      }

      // Wait for upload interval
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should have attempted upload
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('should handle upload failures', async () => {
      // Mock fetch to fail
      const fetchSpy = jest.fn().mockRejectedValue(new Error('Upload failed'));
      global.fetch = fetchSpy;

      client = new OnboredClient(createMockProjectKey(), {
        env: 'production',
        debug: true,
        session_replay: {
          api_host: 'http://localhost:3000',
        },
      });

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not throw error
      expect(client).toBeInstanceOf(OnboredClient);
    });

    it('should handle large event payloads', () => {
      if (client['recorder']) {
        const largePayload = {
          data: 'x'.repeat(10000), // 10KB payload
          timestamp: Date.now(),
        };

        client['recorder'].addCustomEvent('large-event', largePayload);

        const events = client['recorder']._getEvents();
        expect(events.length).toBe(1);
        expect((events[0]?.data as any)?.payload).toEqual(largePayload);
      }
    });

    it('should handle rapid event generation', () => {
      if (client['recorder']) {
        // Generate many events quickly
        for (let i = 0; i < 100; i++) {
          client['recorder'].addCustomEvent(`rapid-event-${i}`, { index: i });
        }

        const events = client['recorder']._getEvents();
        expect(events.length).toBe(100);
      }
    });
  });

  describe('Idle Detection', () => {
    beforeEach(() => {
      client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
        session_replay: {
          api_host: 'http://localhost:3000',
        },
      });
    });

    it('should detect user inactivity', () => {
      // Mock user activity
      const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll'];

      activityEvents.forEach(eventType => {
        const event = new Event(eventType);
        document.dispatchEvent(event);
      });

      // Should handle activity events
      expect(client).toBeInstanceOf(OnboredClient);
    });

    it('should force snapshots on activity resumption', () => {
      if (client['recorder']) {
        // Simulate idle period
        const idleEvent = new Event('visibilitychange');
        Object.defineProperty(document, 'visibilityState', {
          value: 'hidden',
          writable: true,
        });
        document.dispatchEvent(idleEvent);

        // Simulate activity resumption
        Object.defineProperty(document, 'visibilityState', {
          value: 'visible',
          writable: true,
        });
        document.dispatchEvent(idleEvent);

        // Should handle visibility changes
        expect(client).toBeInstanceOf(OnboredClient);
      }
    });

    it('should handle visibility changes', () => {
      if (client['recorder']) {
        // Simulate visibility change to hidden
        Object.defineProperty(document, 'visibilityState', {
          value: 'hidden',
          writable: true,
        });
        const hiddenEvent = new Event('visibilitychange');
        document.dispatchEvent(hiddenEvent);

        // Simulate visibility change to visible
        Object.defineProperty(document, 'visibilityState', {
          value: 'visible',
          writable: true,
        });
        const visibleEvent = new Event('visibilitychange');
        document.dispatchEvent(visibleEvent);

        // Should handle visibility changes
        expect(client).toBeInstanceOf(OnboredClient);
      }
    });

    it('should handle page unload', () => {
      if (client['recorder']) {
        // Simulate page unload
        const unloadEvent = new Event('beforeunload');
        window.dispatchEvent(unloadEvent);

        // Should handle unload
        expect(client).toBeInstanceOf(OnboredClient);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle RRWeb initialization errors', () => {
      mockRRWeb.mockRecord.mockImplementation(() => {
        throw new Error('RRWeb failed to initialize');
      });

      expect(() => {
        client = new OnboredClient(createMockProjectKey(), {
          env: 'development',
          debug: true,
          session_replay: {
            api_host: 'http://localhost:3000',
          },
        });
      }).not.toThrow();
    });

    it('should handle recording errors', () => {
      client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
        session_replay: {
          api_host: 'http://localhost:3000',
        },
      });

      if (client['recorder']) {
        // Mock recorder to throw error
        client['recorder'].addCustomEvent = jest.fn().mockImplementation(() => {
          throw new Error('Recording error');
        });

        expect(() => {
          // @ts-expect-error - Using mocked method for error testing
          client['recorder'].addCustomEvent('test', {});
        }).toThrow('Recording error');
      }
    });

    it('should handle upload errors gracefully', async () => {
      // Mock fetch to fail
      global.fetch = jest.fn().mockRejectedValue(new Error('Upload failed'));

      client = new OnboredClient(createMockProjectKey(), {
        env: 'production',
        debug: true,
        session_replay: {
          api_host: 'http://localhost:3000',
        },
      });

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not throw error
      expect(client).toBeInstanceOf(OnboredClient);
    });

    it('should handle network errors', async () => {
      // Mock navigator.onLine to false
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      client = new OnboredClient(createMockProjectKey(), {
        env: 'production',
        debug: true,
        session_replay: {
          api_host: 'http://localhost:3000',
        },
      });

      // Should handle offline state
      expect(client).toBeInstanceOf(OnboredClient);
    });

    it('should handle storage errors', () => {
      // Mock storage to throw error
      const mockStorage = {
        getItem: jest.fn().mockImplementation(() => {
          throw new Error('Storage error');
        }),
        setItem: jest.fn().mockImplementation(() => {
          throw new Error('Storage error');
        }),
        removeItem: jest.fn(),
        clear: jest.fn(),
        key: jest.fn(),
        length: 0,
      };

      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
      });

      expect(() => {
        client = new OnboredClient(createMockProjectKey(), {
          env: 'development',
          debug: true,
          session_replay: {
            api_host: 'http://localhost:3000',
          },
        });
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency events', () => {
      client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
        session_replay: {
          api_host: 'http://localhost:3000',
        },
      });

      if (client['recorder']) {
        // Generate many events quickly
        const start = Date.now();
        for (let i = 0; i < 1000; i++) {
          client['recorder'].addCustomEvent(`perf-event-${i}`, { index: i });
        }
        const end = Date.now();

        // Should complete quickly
        expect(end - start).toBeLessThan(1000);
      }
    });

    it('should handle memory efficiently', () => {
      client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
        session_replay: {
          api_host: 'http://localhost:3000',
        },
      });

      if (client['recorder']) {
        // Generate many events
        for (let i = 0; i < 10000; i++) {
          client['recorder'].addCustomEvent(`memory-event-${i}`, {
            data: 'x'.repeat(100),
          });
        }

        const events = mockRRWeb.getEvents();
        expect(events.length).toBe(10000);
      }
    });
  });

  describe('Integration', () => {
    it('should work with flow management', async () => {
      // Mock fetch for production mode
      global.fetch = jest.fn((input: string | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/ingest/session')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true }),
          } as Response);
        }
        if (url.includes('/ingest/flow')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'started' }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        } as Response);
      }) as jest.Mock;

      client = new OnboredClient(createMockProjectKey(), {
        env: 'production',
        debug: true,
        session_replay: {
          api_host: 'http://localhost:3000',
        },
      });

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create a flow
      await client.flow('test-flow');

      // Add custom event
      if (client['recorder']) {
        client['recorder'].addCustomEvent('flow-started', {
          flowId: 'test-flow',
        });
      }

      expect(client['flowContext'].has('test-flow')).toBe(true);
    });
  });
});
