/**
 * Flow Management Tests
 *
 * Comprehensive tests for OnBored SDK flow management covering:
 * - Flow creation and completion
 * - Step management
 * - Flow context persistence
 * - Error handling and edge cases
 */

import { OnboredClient } from '../lib/client';
import {
  createMockProjectKey,
  setupTestEnvironment,
  cleanupTestEnvironment,
  expectValidEventPayload,
  TEST_FLOWS,
  TEST_STEPS,
} from './utils/testUtils';
import { mockApiResponses } from './mocks/mockFetch';
import { getMockStorage } from './mocks/mockStorage';

describe('Flow Management', () => {
  let client: OnboredClient;
  let mockStorage: ReturnType<typeof getMockStorage>;

  beforeEach(() => {
    setupTestEnvironment();
    mockApiResponses();
    mockStorage = getMockStorage();

    client = new OnboredClient(createMockProjectKey(), {
      env: 'development',
      debug: true,
      accountId: 'test-account-id', // Add accountId so events go to queue instead of buffer
    });
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  describe('Flow Creation', () => {
    it('should create flow with valid slug', async () => {
      await client.funnel(TEST_FLOWS.ONBOARDING);

      expect(client['flowContext'].has(TEST_FLOWS.ONBOARDING)).toBe(true);
      const context = client['flowContext'].get(TEST_FLOWS.ONBOARDING);
      expect(context).toBeDefined();
      expect(context?.status).toBe('started');
    });

    it('should generate unique flow ID', async () => {
      await client.funnel(TEST_FLOWS.ONBOARDING);

      const context = client['flowContext'].get(TEST_FLOWS.ONBOARDING);
      expect(context?.id).toBeTruthy();
      expect(context?.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should store flow context', async () => {
      await client.funnel(TEST_FLOWS.ONBOARDING);

      const context = client['flowContext'].get(TEST_FLOWS.ONBOARDING);
      expect(context).toBeDefined();
      expect(context?.startedAt).toBeGreaterThan(0);
      expect(context?.status).toBe('started');
    });

    it('should queue flow if SDK not initialized', () => {
      // Create client in production mode to trigger initialization
      const prodClient = new OnboredClient(createMockProjectKey(), {
        env: 'production',
        debug: true,
      });

      // Call flow before initialization completes
      prodClient.funnel(TEST_FLOWS.ONBOARDING);

      expect(prodClient['queuedFlows']).toContain(TEST_FLOWS.ONBOARDING);
    });

    it('should prevent duplicate flows', async () => {
      await client.funnel(TEST_FLOWS.ONBOARDING);
      await client.funnel(TEST_FLOWS.ONBOARDING);

      expect(client['flowContext'].size).toBe(1);
      expect(client['flowContext'].has(TEST_FLOWS.ONBOARDING)).toBe(true);
    });

    it('should handle multiple different flows', async () => {
      await client.funnel(TEST_FLOWS.ONBOARDING);
      await client.funnel(TEST_FLOWS.CHECKOUT);
      await client.funnel(TEST_FLOWS.SIGNUP);

      expect(client['flowContext'].size).toBe(3);
      expect(client['flowContext'].has(TEST_FLOWS.ONBOARDING)).toBe(true);
      expect(client['flowContext'].has(TEST_FLOWS.CHECKOUT)).toBe(true);
      expect(client['flowContext'].has(TEST_FLOWS.SIGNUP)).toBe(true);
    });
  });

  describe('Flow Completion', () => {
    beforeEach(async () => {
      await client.funnel(TEST_FLOWS.ONBOARDING);
    });

    it('should mark flow as complete', async () => {
      await client.complete({ slug: TEST_FLOWS.ONBOARDING });

      const context = client['flowContext'].get(TEST_FLOWS.ONBOARDING);
      expect(context?.status).toBe('complete');
    });

    it('should update flow context status', async () => {
      const originalContext = client['flowContext'].get(TEST_FLOWS.ONBOARDING);
      await client.complete({ slug: TEST_FLOWS.ONBOARDING });

      const updatedContext = client['flowContext'].get(TEST_FLOWS.ONBOARDING);
      expect(updatedContext?.id).toBe(originalContext?.id);
      expect(updatedContext?.startedAt).toBe(originalContext?.startedAt);
      expect(updatedContext?.status).toBe('complete');
    });

    it('should flush events immediately on completion', async () => {
      const flushSpy = jest.spyOn(client as any, '_flush');

      await client.complete({ slug: TEST_FLOWS.ONBOARDING });

      expect(flushSpy).toHaveBeenCalled();
    });

    it('should handle completion without active flow', async () => {
      // Try to complete a flow that doesn't exist
      await client.complete({ slug: 'non-existent-flow' });

      // Should not throw error - only the onboarding flow should exist
      expect(client['flowContext'].size).toBe(1);
    });

    it('should save flow context to storage on completion', async () => {
      await client.complete({ slug: TEST_FLOWS.ONBOARDING });

      expect(mockStorage.sessionStorage.setItem).toHaveBeenCalled();
      const calls = mockStorage.sessionStorage.setItem.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      expect(lastCall).toBeDefined();
      if (lastCall) {
        const storedData = JSON.parse(lastCall[1] as string);
        expect(storedData.sessionId).toBe(client['sessionId']);
        expect(storedData.flows).toHaveLength(1);
      }
    });
  });

  describe('Step Management', () => {
    beforeEach(async () => {
      await client.funnel(TEST_FLOWS.ONBOARDING);
    });

    it('should track step completion', async () => {
      await client.step(TEST_STEPS.WELCOME, { slug: TEST_FLOWS.ONBOARDING });

      // Check that event was captured
      expect(client['eventQueue'].length).toBeGreaterThan(0);
      const event = client['eventQueue'].find(
        e => e.event_type === 'step_completed'
      );
      expect(event).toBeDefined();
      expect(event?.step_id).toBe(TEST_STEPS.WELCOME);
    });

    it('should track step skipping', async () => {
      await client.skip(TEST_STEPS.WELCOME, { slug: TEST_FLOWS.ONBOARDING });

      // Check that event was captured
      expect(client['eventQueue'].length).toBeGreaterThan(0);
      const event = client['eventQueue'].find(
        e => e.event_type === 'step_abandoned'
      );
      expect(event).toBeDefined();
      expect(event?.step_id).toBe(TEST_STEPS.WELCOME);
    });

    it('should handle step abandonment', async () => {
      await client.skip(TEST_STEPS.WELCOME, { slug: TEST_FLOWS.ONBOARDING });

      const event = client['eventQueue'].find(
        e => e.event_type === 'step_abandoned'
      );
      expect(event).toBeDefined();
      expect(event?.step_id).toBe(TEST_STEPS.WELCOME);
    });

    it('should queue steps before flow creation', async () => {
      // Clear session storage to ensure clean state
      sessionStorage.clear();

      // Create new client and call step before flow (testing the _viewStep queue behavior)
      const newClient = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      // Verify no flows exist
      expect(newClient['flowContext'].size).toBe(0);

      // Directly call the internal _viewStep method to test queuing
      // Note: step() won't queue if there's no flow context, it just returns
      // So this test is actually testing _viewStep behavior which is called by auto-tracking
      const stepName = TEST_STEPS.WELCOME;
      const options = { slug: TEST_FLOWS.ONBOARDING };

      // Call _viewStep directly (private method accessed via bracket notation)
      (newClient as any)._viewStep(stepName, options);

      // Step should be queued since flow doesn't exist yet
      expect(newClient['queuedStepViews'].length).toBe(1);
      const firstQueued = newClient['queuedStepViews'][0];
      expect(firstQueued).toBeDefined();
      if (firstQueued) {
        expect(firstQueued.stepName).toBe(TEST_STEPS.WELCOME);
      }
    });

    it('should process queued steps after flow creation', async () => {
      // Clear session storage to ensure clean state
      sessionStorage.clear();

      const newClient = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
        accountId: 'test-account-id', // Add accountId so events don't get buffered
      });

      // Verify no flows exist
      expect(newClient['flowContext'].size).toBe(0);

      // Queue a step view (simulating auto-tracking behavior)
      (newClient as any)._viewStep(TEST_STEPS.WELCOME, {
        slug: TEST_FLOWS.ONBOARDING,
      });

      // Verify step is queued
      expect(newClient['queuedStepViews'].length).toBe(1);

      // Create the flow
      await newClient.funnel(TEST_FLOWS.ONBOARDING);

      // Queued step should be processed
      expect(newClient['queuedStepViews'].length).toBe(0);
      expect(newClient['eventQueue'].length).toBeGreaterThan(0);

      // Verify the step_viewed event was created
      const stepEvent = newClient['eventQueue'].find(
        e => e.event_type === 'step_viewed'
      );
      expect(stepEvent).toBeDefined();
      expect(stepEvent?.step_id).toBe(TEST_STEPS.WELCOME);
    });

    it('should handle step without active flow gracefully', async () => {
      const initialQueueLength = client['eventQueue'].length;
      await client.step(TEST_STEPS.WELCOME, { slug: 'non-existent-flow' });

      // Should not throw error and should not add new events
      expect(client['eventQueue'].length).toBe(initialQueueLength);
    });

    it('should handle skip without active flow gracefully', async () => {
      const initialQueueLength = client['eventQueue'].length;
      await client.skip(TEST_STEPS.WELCOME, { slug: 'non-existent-flow' });

      // Should not throw error and should not add new events
      expect(client['eventQueue'].length).toBe(initialQueueLength);
    });
  });

  describe('Flow Context Persistence', () => {
    it('should save flow context to sessionStorage', async () => {
      await client.funnel(TEST_FLOWS.ONBOARDING);

      expect(mockStorage.sessionStorage.setItem).toHaveBeenCalled();
      const calls = mockStorage.sessionStorage.setItem.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      expect(lastCall).toBeDefined();
      if (lastCall) {
        const storedData = JSON.parse(lastCall[1] as string);
        expect(storedData.sessionId).toBe(client['sessionId']);
        expect(storedData.flows).toHaveLength(1);
      }
    });

    it('should restore flow context on reload', () => {
      const storedContext = {
        sessionId: client['sessionId'],
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

      const newClient = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      expect(newClient['flowContext'].size).toBe(1);
      expect(newClient['flowContext'].has('test-flow')).toBe(true);
    });

    it('should clear context on session change', () => {
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

      const newClient = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      expect(newClient['flowContext'].size).toBe(0);
    });

    it('should handle invalid stored context', () => {
      mockStorage.sessionStorage.getItem.mockReturnValue('invalid-json');

      const newClient = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      expect(newClient['flowContext'].size).toBe(0);
    });

    it('should handle missing stored context', () => {
      mockStorage.sessionStorage.getItem.mockReturnValue(null);

      const newClient = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
      });

      expect(newClient['flowContext'].size).toBe(0);
    });
  });

  describe('Event Capture', () => {
    beforeEach(async () => {
      await client.funnel(TEST_FLOWS.ONBOARDING);
    });

    it('should capture flow started event', async () => {
      // Clear session storage to ensure clean state
      sessionStorage.clear();

      // Create a fresh client with accountId so funnel is not buffered
      const newClient = new OnboredClient(createMockProjectKey(), {
        env: 'development',
        debug: true,
        accountId: 'test-account-id',
      });

      await newClient.funnel(TEST_FLOWS.ONBOARDING);

      expect(newClient['eventQueue'].length).toBeGreaterThan(0);
      const event = newClient['eventQueue'].find(
        e => e.event_type === 'flow_started'
      );
      expect(event).toBeDefined();
      expect(event?.funnel_slug).toBe(TEST_FLOWS.ONBOARDING);
    });

    it('should capture flow complete event', async () => {
      await client.complete({ slug: TEST_FLOWS.ONBOARDING });

      expect(client['eventQueue'].length).toBeGreaterThan(0);
      const event = client['eventQueue'].find(
        e => e.event_type === 'flow_completed'
      );
      expect(event).toBeDefined();
      expect(event?.funnel_slug).toBe(TEST_FLOWS.ONBOARDING);
    });

    it('should capture step complete event', async () => {
      await client.step(TEST_STEPS.WELCOME, { slug: TEST_FLOWS.ONBOARDING });

      expect(client['eventQueue'].length).toBeGreaterThan(0);
      const event = client['eventQueue'].find(
        e => e.event_type === 'step_completed'
      );
      expect(event).toBeDefined();
      expect(event?.step_id).toBe(TEST_STEPS.WELCOME);
    });

    it('should capture step abandoned event', async () => {
      await client.skip(TEST_STEPS.WELCOME, { slug: TEST_FLOWS.ONBOARDING });

      expect(client['eventQueue'].length).toBeGreaterThan(0);
      const event = client['eventQueue'].find(
        e => e.event_type === 'step_abandoned'
      );
      expect(event).toBeDefined();
      expect(event?.step_id).toBe(TEST_STEPS.WELCOME);
    });

    it('should include metadata in events', async () => {
      const metadata = { custom: 'data' };
      await client.step(TEST_STEPS.WELCOME, {
        slug: TEST_FLOWS.ONBOARDING,
        ...metadata,
      });

      const event = client['eventQueue'].find(
        e => e.event_type === 'step_completed'
      );
      expect(event?.metadata).toEqual(expect.objectContaining(metadata));
    });

    it('should validate event payloads', async () => {
      await client.step(TEST_STEPS.WELCOME, { slug: TEST_FLOWS.ONBOARDING });

      const event = client['eventQueue'].find(
        e => e.event_type === 'step_completed'
      );
      expect(event).toBeDefined();
      if (event) {
        expectValidEventPayload(event);
      }
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await client.funnel(TEST_FLOWS.ONBOARDING);
    });

    it('should handle flow creation errors gracefully', async () => {
      // Mock fetch to throw error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const prodClient = new OnboredClient(createMockProjectKey(), {
        env: 'production',
        debug: true,
      });

      // Call flow - it will be queued because client is still initializing
      prodClient.funnel(TEST_FLOWS.ONBOARDING);

      // Flow is queued immediately (sync operation)
      expect(prodClient['queuedFlows']).toContain(TEST_FLOWS.ONBOARDING);
    });

    it('should handle step errors gracefully', async () => {
      const initialQueueLength = client['eventQueue'].length;
      await client.step(TEST_STEPS.WELCOME, { slug: TEST_FLOWS.ONBOARDING });

      // Should not throw error and should add the step event
      expect(client['eventQueue'].length).toBe(initialQueueLength + 1);
    });

    it('should handle completion errors gracefully', async () => {
      // First create the flow
      await client.funnel(TEST_FLOWS.ONBOARDING);

      await client.complete({ slug: TEST_FLOWS.ONBOARDING });

      // Should not throw error
      expect(client['flowContext'].get(TEST_FLOWS.ONBOARDING)?.status).toBe(
        'complete'
      );
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.sessionStorage.setItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      await client.funnel(TEST_FLOWS.ONBOARDING);

      // Should not throw error - flow should still be in memory
      expect(client['flowContext'].size).toBe(1);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent flow operations', async () => {
      const promises = [
        client.funnel(TEST_FLOWS.ONBOARDING),
        client.funnel(TEST_FLOWS.CHECKOUT),
        client.funnel(TEST_FLOWS.SIGNUP),
      ];

      await Promise.all(promises);

      expect(client['flowContext'].size).toBe(3);
    });

    it('should handle concurrent step operations', async () => {
      await client.funnel(TEST_FLOWS.ONBOARDING);
      const initialQueueLength = client['eventQueue'].length;

      const promises = [
        client.step(TEST_STEPS.WELCOME, { slug: TEST_FLOWS.ONBOARDING }),
        client.step(TEST_STEPS.FORM, { slug: TEST_FLOWS.ONBOARDING }),
        client.step(TEST_STEPS.CONFIRMATION, { slug: TEST_FLOWS.ONBOARDING }),
      ];

      await Promise.all(promises);

      expect(client['eventQueue'].length).toBe(initialQueueLength + 3);
    });

    it('should handle mixed operations', async () => {
      await client.funnel(TEST_FLOWS.ONBOARDING);
      const initialQueueLength = client['eventQueue'].length;

      const promises = [
        client.step(TEST_STEPS.WELCOME, { slug: TEST_FLOWS.ONBOARDING }),
        client.skip(TEST_STEPS.FORM, { slug: TEST_FLOWS.ONBOARDING }),
        client.complete({ slug: TEST_FLOWS.ONBOARDING }),
      ];

      await Promise.all(promises);

      expect(client['flowContext'].get(TEST_FLOWS.ONBOARDING)?.status).toBe(
        'complete'
      );
      expect(client['eventQueue'].length).toBe(initialQueueLength + 3);
    });
  });
});
