/**
 * Event Buffer Tests
 *
 * Tests for the event buffering functionality that buffers events
 * when no accountId is present and flushes them when identifyAccount is called.
 */

import { OnboredClient } from '../lib/client';
import {
  createMockOptions,
  createMockProjectKey,
  setupTestEnvironment,
  cleanupTestEnvironment,
} from './utils/testUtils';
import { mockApiResponses } from './mocks/mockFetch';
import { getMockStorage } from './mocks/mockStorage';
import { setCustomUUIDs } from './mocks/mockUUID';

describe('Event Buffer', () => {
  beforeEach(() => {
    setupTestEnvironment();
    mockApiResponses();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  describe('Buffering Events Without Account', () => {
    it('should buffer events when no accountId is provided', async () => {
      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      // Capture event without accountId
      await client.capture('page_viewed', {
        url: 'http://example.com/page1',
      });

      await client.capture('page_viewed', {
        url: 'http://example.com/page2',
      });

      // Events should be buffered
      const bufferedEvents = client._getBufferedEvents();
      expect(bufferedEvents.length).toBe(2);
      expect(bufferedEvents[0]?.event_type).toBe('page_viewed');
      expect(bufferedEvents[1]?.event_type).toBe('page_viewed');
    });

    it('should persist buffer to localStorage', async () => {
      const mockStorage = getMockStorage();
      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Capture event without accountId
      await client.capture('page_viewed', {
        url: 'http://example.com/page1',
      });

      // Buffer should be persisted
      expect(mockStorage.localStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('ob-buffer-'),
        expect.any(String)
      );
    });

    it('should restore buffer from localStorage on initialization', () => {
      const mockStorage = getMockStorage();
      const projectKey = createMockProjectKey();
      const bufferKey = `ob-buffer-${projectKey}`;

      const bufferedEvents = [
        {
          id: 'event-1',
          event_type: 'page_viewed',
          url: 'http://example.com',
          session_id: 'session-1',
          timestamp: new Date().toISOString(),
          timezone: 'Europe/London',
          timezone_offset: 0,
          project_key: projectKey,
        },
      ];

      mockStorage.localStorage.getItem.mockImplementation((key: string) => {
        if (key === bufferKey) {
          return JSON.stringify(bufferedEvents);
        }
        return null;
      });

      const client = new OnboredClient(projectKey, {
        env: 'development',
        debug: true,
      });

      // Buffer should be restored
      const restoredBuffer = client._getBufferedEvents();
      expect(restoredBuffer.length).toBe(1);
      expect(restoredBuffer[0]?.event_type).toBe('page_viewed');
    });

    it('should not buffer events when accountId is already present', async () => {
      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
        accountId: 'test-account',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Capture event with accountId
      await client.capture('page_viewed', {
        url: 'http://example.com/page1',
      });

      // Events should NOT be buffered
      const bufferedEvents = client._getBufferedEvents();
      expect(bufferedEvents.length).toBe(0);

      // Events should be in the regular queue
      const queuedEvents = client._getEvents();
      expect(queuedEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Flushing Buffer on identifyAccount', () => {
    it('should flush buffer when identifyAccount is called', async () => {
      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Generate 5 events without account
      await client.capture('page_viewed', { url: 'http://example.com/1' });
      await client.capture('page_viewed', { url: 'http://example.com/2' });
      await client.capture('page_viewed', { url: 'http://example.com/3' });
      await client.capture('page_viewed', { url: 'http://example.com/4' });
      await client.capture('page_viewed', { url: 'http://example.com/5' });

      // Verify events are buffered
      expect(client._getBufferSize()).toBe(5);

      // Identify account
      await client.identifyAccount('test-account-123');

      // Buffer should be cleared
      expect(client._getBufferSize()).toBe(0);

      // Events should be moved to event queue
      const queuedEvents = client._getEvents();
      expect(queuedEvents.length).toBeGreaterThanOrEqual(5);

      // All flushed events should have the account_id
      const flushedEvents = queuedEvents.filter(
        e => e.event_type === 'page_viewed'
      );
      flushedEvents.forEach(event => {
        expect(event.account_id).toBe('test-account-123');
      });
    });

    it('should mark buffered events with preauth metadata', async () => {
      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Generate events without account
      await client.capture('page_viewed', { url: 'http://example.com/1' });
      await client.capture('page_viewed', { url: 'http://example.com/2' });

      // Identify account
      await client.identifyAccount('test-account-123');

      // Flushed events should have preauth flag
      const queuedEvents = client._getEvents();
      const flushedEvents = queuedEvents.filter(
        e => e.event_type === 'page_viewed'
      );

      flushedEvents.forEach(event => {
        expect(event.metadata).toHaveProperty('preauth', true);
      });
    });

    it('should clear buffer from localStorage after flush', async () => {
      const mockStorage = getMockStorage();
      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Generate events without account
      await client.capture('page_viewed', { url: 'http://example.com/1' });

      // Identify account
      await client.identifyAccount('test-account-123');

      // Buffer should be removed from localStorage
      expect(mockStorage.localStorage.removeItem).toHaveBeenCalledWith(
        expect.stringContaining('ob-buffer-')
      );
    });

    it('should not flush if already has accountId', async () => {
      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
        accountId: 'initial-account',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const initialQueueLength = client._getEvents().length;

      // Call identifyAccount again with same account
      await client.identifyAccount('initial-account');

      // Queue length should not change significantly
      const finalQueueLength = client._getEvents().length;
      expect(finalQueueLength).toBe(initialQueueLength);
    });
  });

  describe('Buffer Persistence', () => {
    it('should handle buffer storage errors gracefully', async () => {
      const mockStorage = getMockStorage();
      mockStorage.localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not throw when persisting buffer fails
      expect(async () => {
        await client.capture('page_viewed', {
          url: 'http://example.com/page1',
        });
      }).not.toThrow();
    });

    it('should handle buffer restoration errors gracefully', () => {
      const mockStorage = getMockStorage();
      mockStorage.localStorage.getItem.mockImplementation((key: string) => {
        if (key.includes('ob-buffer-')) {
          return 'invalid-json';
        }
        return null;
      });

      expect(() => {
        new OnboredClient(createMockProjectKey(), {
          env: 'development',
          debug: true,
        });
      }).not.toThrow();
    });
  });

  describe('Buffer Cleanup', () => {
    it('should clear buffer on reset', async () => {
      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Buffer some events
      await client.capture('page_viewed', { url: 'http://example.com/1' });
      await client.capture('page_viewed', { url: 'http://example.com/2' });

      expect(client._getBufferSize()).toBe(2);

      // Reset
      client.reset();

      // Buffer should be cleared
      expect(client._getBufferSize()).toBe(0);
    });

    it('should clear buffer on destroy', async () => {
      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Buffer some events
      await client.capture('page_viewed', { url: 'http://example.com/1' });

      expect(client._getBufferSize()).toBe(1);

      // Destroy
      client.destroy();

      // Buffer should be cleared
      expect(client._getBufferSize()).toBe(0);
    });
  });

  describe('Debug Methods', () => {
    it('should provide _getBufferedEvents for debugging', async () => {
      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      await client.capture('page_viewed', { url: 'http://example.com/1' });

      const bufferedEvents = client._getBufferedEvents();
      expect(Array.isArray(bufferedEvents)).toBe(true);
      expect(bufferedEvents.length).toBe(1);
    });

    it('should provide _getBufferSize for debugging', async () => {
      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      await client.capture('page_viewed', { url: 'http://example.com/1' });
      await client.capture('page_viewed', { url: 'http://example.com/2' });

      expect(client._getBufferSize()).toBe(2);
    });
  });

  describe('Flow ID Preservation in Buffered Events', () => {
    it('should generate flowId when funnel is buffered without accountId', async () => {
      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Start a funnel without accountId
      await client.funnel('onboarding');

      // Check that funnel is buffered with flowId
      const bufferedFunnels = client._getBufferedFunnels();
      expect(bufferedFunnels.length).toBe(1);
      expect(bufferedFunnels[0]).toHaveProperty('slug', 'onboarding');
      expect(bufferedFunnels[0]).toHaveProperty('flowId');
      expect(bufferedFunnels[0]?.flowId).toBeTruthy();
    });

    it('should allow events to reference flowId from buffered funnel', async () => {
      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Start a funnel without accountId
      await client.funnel('onboarding');

      // Get the buffered funnel's flowId
      const bufferedFunnels = client._getBufferedFunnels();
      const funnelFlowId = bufferedFunnels[0]?.flowId;

      // Track a step - this should get the flowId from flow context
      await client.step('profile_created', { slug: 'onboarding' });

      // Get buffered events
      const bufferedEvents = client._getBufferedEvents();
      const stepEvent = bufferedEvents.find(
        e => e.event_type === 'step_completed'
      );

      // Event should have the same flowId as the buffered funnel
      expect(stepEvent).toBeDefined();
      expect(stepEvent?.flow_id).toBe(funnelFlowId);
    });

    it('should preserve flowIds when flushing buffered funnels', async () => {
      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Start a funnel without accountId
      await client.funnel('onboarding', { source: 'signup' });

      // Get the original flowId
      const bufferedFunnels = client._getBufferedFunnels();
      const originalFlowId = bufferedFunnels[0]?.flowId;

      // Track some steps
      await client.step('profile_created', { slug: 'onboarding' });
      await client.step('email_verified', { slug: 'onboarding' });

      // Identify account - this should flush the buffered funnel
      await client.identifyAccount('test-account-123');

      // Check that the funnel buffer is cleared
      expect(client._getBufferedFunnels().length).toBe(0);

      // Check that events in the queue have the same flowId
      const queuedEvents = client._getEvents();
      const flowStartedEvent = queuedEvents.find(
        e => e.event_type === 'flow_started'
      );
      const stepEvents = queuedEvents.filter(
        e => e.event_type === 'step_completed'
      );

      expect(flowStartedEvent).toBeDefined();
      expect(flowStartedEvent?.flow_id).toBe(originalFlowId);
      expect(stepEvents.length).toBe(2);
      stepEvents.forEach(event => {
        expect(event.flow_id).toBe(originalFlowId);
      });
    });

    it('should include accountId in flushed funnel event', async () => {
      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Start a funnel without accountId
      await client.funnel('onboarding');

      // Identify account
      await client.identifyAccount('test-account-123');

      // Check that flow_started event has accountId
      const queuedEvents = client._getEvents();
      const flowStartedEvent = queuedEvents.find(
        e => e.event_type === 'flow_started'
      );

      expect(flowStartedEvent).toBeDefined();
      expect(flowStartedEvent?.account_id).toBe('test-account-123');
    });

    it('should handle multiple buffered funnels with different flowIds', async () => {
      // Setup custom UUIDs for crypto.randomUUID
      const uuids = [
        // Session ID
        '11111111-1111-1111-1111-111111111111',
        // onboarding funnel flowId
        '22222222-2222-2222-2222-222222222222',
        // feature-tour funnel flowId
        '44444444-4444-4444-4444-444444444444',
        // upgrade-flow funnel flowId
        '66666666-6666-6666-6666-666666666666',
        // step1 onboarding event ID
        '88888888-8888-8888-8888-888888888888',
        // step1 feature-tour event ID
        '99999999-9999-9999-9999-999999999999',
        // flow_started event for onboarding (when flushed)
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        // flow_started event for feature-tour (when flushed)
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        // flow_started event for upgrade-flow (when flushed)
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
      ];

      let uuidIndex = 0;
      const originalRandomUUID = crypto.randomUUID;
      crypto.randomUUID = jest.fn(() => uuids[uuidIndex++] || originalRandomUUID()) as () => `${string}-${string}-${string}-${string}-${string}`;

      const client = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Start multiple funnels without accountId
      await client.funnel('onboarding');
      await client.funnel('feature-tour');
      await client.funnel('upgrade-flow');

      // Get buffered funnels
      const bufferedFunnels = client._getBufferedFunnels();
      expect(bufferedFunnels.length).toBe(3);

      // Each should have a unique flowId
      const flowIds = bufferedFunnels.map(f => f.flowId);
      const uniqueFlowIds = new Set(flowIds);
      expect(uniqueFlowIds.size).toBe(3);

      // Track steps in different funnels
      await client.step('step1', { slug: 'onboarding' });
      await client.step('step1', { slug: 'feature-tour' });

      // Identify account
      await client.identifyAccount('test-account-123');

      // Verify all flow_started events have different flowIds
      const queuedEvents = client._getEvents();
      const flowStartedEvents = queuedEvents.filter(
        e => e.event_type === 'flow_started'
      );

      expect(flowStartedEvents.length).toBe(3);
      const queuedFlowIds = flowStartedEvents.map(e => e.flow_id);
      const uniqueQueuedFlowIds = new Set(queuedFlowIds);
      expect(uniqueQueuedFlowIds.size).toBe(3);

      // Verify flowIds match the original buffered flowIds
      flowIds.forEach(flowId => {
        expect(queuedFlowIds).toContain(flowId);
      });

      // Cleanup: restore original randomUUID
      crypto.randomUUID = originalRandomUUID;
    });
  });
});
