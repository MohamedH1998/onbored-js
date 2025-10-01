/**
 * E2E Test Helpers
 *
 * Comprehensive test utilities for OnBored SDK E2E testing including:
 * - Browser automation helpers
 * - SDK interaction utilities
 * - Test data generators
 * - Assertion helpers
 * - Performance monitoring
 */

/// <reference path="../types.d.ts" />
import { Page, expect } from '@playwright/test';
import { EventType } from '../../src/lib/types';
import { SessionReplayOptions } from '../../src/lib/session-replay/types';

export interface TestConfig {
  projectKey: string;
  userId: string;
  environment: 'development' | 'production';
  debug: boolean;
  sessionReplay: boolean;
  apiHost: string;
}

export const DEFAULT_TEST_CONFIG: TestConfig = {
  projectKey: 'test-project-key',
  userId: 'test-user-123',
  environment: 'development',
  debug: true,
  sessionReplay: false,
  apiHost: 'http://localhost:3000',
};

export class OnBoredTestHelper {
  private page: Page;
  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Initialize the OnBored SDK with test configuration
   */
  async initializeSDK(config: Partial<TestConfig> = {}): Promise<void> {
    const finalConfig = { ...DEFAULT_TEST_CONFIG, ...config };

    // Wait for SDK to be loaded
    await this.page.waitForFunction(
      () => typeof window.onbored !== 'undefined',
      {
        timeout: 5000,
      }
    );

    await this.page.evaluate(cfg => {
      window.onbored.init({
        projectKey: cfg.projectKey,
        user_id: cfg.userId,
        env: cfg.environment,
        debug: cfg.debug,
        session_replay: cfg.sessionReplay
          ? ({
              api_host: cfg.apiHost,
            } as unknown as SessionReplayOptions)
          : false,
      });
    }, finalConfig);

    // Wait for initialization to complete
    await this.page.waitForTimeout(100);
  }

  /**
   * Create a flow with the given slug
   */
  async createFlow(slug: string): Promise<void> {
    await this.page.evaluate(flowSlug => {
      window.onbored.flow(flowSlug);
    }, slug);

    // Wait for flow to be created
    await this.page.waitForTimeout(100);
  }

  /**
   * Complete a step in a flow
   */
  async completeStep(
    stepName: string,
    slug: string,
    metadata: any = {}
  ): Promise<void> {
    await this.page.evaluate(
      ({ step, flowSlug, meta }) => {
        window.onbored.step(step, { slug: flowSlug, ...meta });
      },
      { step: stepName, flowSlug: slug, meta: metadata }
    );
  }

  /**
   * Skip a step in a flow
   */
  async skipStep(
    stepName: string,
    slug: string,
    metadata: any = {}
  ): Promise<void> {
    await this.page.evaluate(
      ({ step, flowSlug, meta }) => {
        window.onbored.skip(step, { slug: flowSlug, ...meta });
      },
      { step: stepName, flowSlug: slug, meta: metadata }
    );
  }

  /**
   * Complete a flow
   */
  async completeFlow(slug: string, metadata: any = {}): Promise<void> {
    await this.page.evaluate(
      ({ flowSlug, meta }) => {
        window.onbored.complete({ slug: flowSlug, ...meta });
      },
      { flowSlug: slug, meta: metadata }
    );
  }

  /**
   * Capture a custom event
   */
  async captureEvent(eventType: string, data: any = {}): Promise<void> {
    await this.page.evaluate(
      ({ event, eventData }) => {
        window.onbored.capture(event as EventType, eventData);
      },
      { event: eventType, eventData: data }
    );
  }

  /**
   * Get all captured events
   */
  async getEvents(): Promise<any[]> {
    return await this.page.evaluate(() => {
      return window.onbored._getEvents();
    });
  }

  /**
   * Get flow context for a specific flow
   */
  async getFlowContext(slug: string): Promise<any> {
    return await this.page.evaluate(flowSlug => {
      return window.onbored._getFlowContext(flowSlug);
    }, slug);
  }

  /**
   * Get session ID
   */
  async getSessionId(): Promise<string> {
    return await this.page.evaluate(() => {
      return window.onbored._getSessionId();
    });
  }

  /**
   * Get recorder instance
   */
  async getRecorder(): Promise<any> {
    return await this.page.evaluate(() => {
      return window.onbored._getRecorder();
    });
  }

  /**
   * Get recorder events
   */
  async getRecorderEvents(): Promise<any[]> {
    return await this.page.evaluate(() => {
      return window.onbored._getRecorderEvents();
    });
  }

  /**
   * Simulate user interaction
   */
  async simulateUserInteraction(): Promise<void> {
    // Click on the page
    await this.page.click('body');

    // Type some text
    await this.page.keyboard.type('test input');

    // Scroll the page
    await this.page.mouse.wheel(0, 100);
  }

  /**
   * Simulate network conditions
   */
  async simulateNetworkConditions(
    condition: 'offline' | 'slow' | 'fast'
  ): Promise<void> {
    switch (condition) {
      case 'offline':
        await this.page.evaluate(() => {
          Object.defineProperty(navigator, 'onLine', {
            value: false,
            writable: true,
          });
          window.dispatchEvent(new Event('offline'));
        });
        break;
      case 'slow':
        await this.page.route('**/ingest/**', route => {
          setTimeout(() => route.continue(), 2000);
        });
        break;
      case 'fast':
        await this.page.route('**/ingest/**', route => {
          route.continue();
        });
        break;
    }
  }

  /**
   * Simulate page navigation
   */
  async simulateNavigation(url: string): Promise<void> {
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Simulate page refresh
   */
  async simulateRefresh(): Promise<void> {
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Simulate visibility changes
   */
  async simulateVisibilityChange(
    visibility: 'visible' | 'hidden'
  ): Promise<void> {
    await this.page.evaluate(vis => {
      Object.defineProperty(document, 'visibilityState', {
        value: vis,
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    }, visibility);
  }

  /**
   * Simulate beforeunload event
   */
  async simulateBeforeUnload(): Promise<void> {
    await this.page.evaluate(() => {
      const event = new Event('beforeunload');
      Object.defineProperty(event, 'returnValue', {
        value: '',
        writable: true,
      });
      window.dispatchEvent(event);
    });
  }

  /**
   * Simulate popstate event
   */
  async simulatePopState(): Promise<void> {
    await this.page.evaluate(() => {
      const event = new PopStateEvent('popstate', { state: null });
      window.dispatchEvent(event);
    });
  }

  /**
   * Wait for specific event to be captured
   */
  async waitForEvent(eventType: string, timeout: number = 5000): Promise<any> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const events = await this.getEvents();
      const event = events.find((e: any) => e.event_type === eventType);
      if (event) {
        return event;
      }
      await this.page.waitForTimeout(100);
    }

    throw new Error(`Event ${eventType} not captured within ${timeout}ms`);
  }

  /**
   * Wait for flow to be created
   */
  async waitForFlow(slug: string, timeout: number = 5000): Promise<any> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const context = await this.getFlowContext(slug);
      if (context) {
        return context;
      }
      await this.page.waitForTimeout(100);
    }

    throw new Error(`Flow ${slug} not created within ${timeout}ms`);
  }

  /**
   * Assert that an event was captured
   */
  async assertEventCaptured(eventType: string): Promise<void> {
    const events = await this.getEvents();
    const event = events.find((e: any) => e.event_type === eventType);
    expect(event).toBeDefined();
  }

  /**
   * Assert that a flow was created
   */
  async assertFlowCreated(slug: string): Promise<void> {
    const context = await this.getFlowContext(slug);
    expect(context).toBeDefined();
    expect(context.status).toBe('started');
  }

  /**
   * Assert that a flow was complete
   */
  async assertFlowCompleted(slug: string): Promise<void> {
    const context = await this.getFlowContext(slug);
    expect(context).toBeDefined();
    expect(context.status).toBe('complete');
  }

  /**
   * Assert that session replay is active
   */
  async assertSessionReplayActive(): Promise<void> {
    const recorder = await this.getRecorder();
    expect(recorder).toBeDefined();
  }

  /**
   * Assert that events were recorded
   */
  async assertEventsRecorded(): Promise<void> {
    const events = await this.getRecorderEvents();
    expect(events.length).toBeGreaterThan(0);
  }

  /**
   * Clear all events and reset state
   */
  async clearState(): Promise<void> {
    await this.page.evaluate(() => {
      if (window.onbored) {
        window.onbored.reset();
      }
    });
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<any> {
    return await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      return {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded:
          navigation.domContentLoadedEventEnd -
          navigation.domContentLoadedEventStart,
        firstPaint:
          performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint:
          performance.getEntriesByName('first-contentful-paint')[0]
            ?.startTime || 0,
      };
    });
  }

  /**
   * Monitor memory usage
   */
  async getMemoryUsage(): Promise<any> {
    return await this.page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory;
      }
      return null;
    });
  }

  /**
   * Take a screenshot for debugging
   */
  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true,
    });
  }

  /**
   * Generate test data
   */
  generateTestData(type: 'user' | 'event' | 'flow'): any {
    const timestamp = Date.now();

    switch (type) {
      case 'user':
        return {
          id: `user-${timestamp}`,
          name: `Test User ${timestamp}`,
          email: `test-${timestamp}@example.com`,
        };
      case 'event':
        return {
          type: 'test_event',
          data: { timestamp, value: Math.random() },
          metadata: { source: 'test' },
        };
      case 'flow':
        return {
          slug: `test-flow-${timestamp}`,
          steps: ['welcome', 'form', 'confirmation'],
          metadata: { test: true },
        };
      default:
        return {};
    }
  }

  /**
   * Create test elements in the DOM
   */
  async createTestElements(): Promise<void> {
    await this.page.evaluate(() => {
      // Create test elements for step tracking
      const container = document.createElement('div');
      container.id = 'test-container';

      const step1 = document.createElement('div');
      step1.setAttribute('data-onbored-step', 'welcome');
      step1.setAttribute('data-onbored-funnel', 'onboarding');
      step1.textContent = 'Welcome Step';
      step1.style.padding = '10px';
      step1.style.margin = '10px';
      step1.style.border = '1px solid #ccc';

      const step2 = document.createElement('div');
      step2.setAttribute('data-onbored-step', 'form');
      step2.setAttribute('data-onbored-funnel', 'onboarding');
      step2.textContent = 'Form Step';
      step2.style.padding = '10px';
      step2.style.margin = '10px';
      step2.style.border = '1px solid #ccc';

      container.appendChild(step1);
      container.appendChild(step2);
      document.body.appendChild(container);
    });
  }

  /**
   * Clean up test elements
   */
  async cleanupTestElements(): Promise<void> {
    await this.page.evaluate(() => {
      const container = document.getElementById('test-container');
      if (container) {
        container.remove();
      }
    });
  }
}

/**
 * Test data generators
 */
export const TestDataGenerators = {
  createUser: (id?: string) => ({
    id: id || `user-${Date.now()}`,
    name: `Test User ${Date.now()}`,
    email: `test-${Date.now()}@example.com`,
    metadata: { source: 'test' },
  }),

  createEvent: (type: string, data: any = {}) => ({
    type,
    data: { ...data, timestamp: Date.now() },
    metadata: { source: 'test' },
  }),

  createFlow: (slug: string, steps: string[] = []) => ({
    slug,
    steps: steps.length > 0 ? steps : ['welcome', 'form', 'confirmation'],
    metadata: { test: true },
  }),

  createStep: (name: string, flowSlug: string, metadata: any = {}) => ({
    name,
    flowSlug,
    metadata: { ...metadata, timestamp: Date.now() },
  }),
};

/**
 * Test assertions
 */
export const TestAssertions = {
  async assertSDKInitialized(page: Page): Promise<void> {
    const isInitialized = await page.evaluate(() => {
      return typeof window.onbored !== 'undefined';
    });
    expect(isInitialized).toBe(true);
  },

  async assertEventCaptured(page: Page, eventType: string): Promise<void> {
    const events = await page.evaluate(() => {
      return window.onbored._getEvents();
    });
    const event = events.find((e: any) => e.event_type === eventType);
    expect(event).toBeDefined();
  },

  async assertFlowCreated(page: Page, slug: string): Promise<void> {
    const context = await page.evaluate(flowSlug => {
      return window.onbored._getFlowContext(flowSlug);
    }, slug);
    expect(context).toBeDefined();
    expect(context?.status).toBe('started');
  },

  async assertFlowCompleted(page: Page, slug: string): Promise<void> {
    const context = await page.evaluate(flowSlug => {
      return window.onbored._getFlowContext(flowSlug);
    }, slug);
    expect(context).toBeDefined();
    expect(context?.status).toBe('complete');
  },

  async assertSessionReplayActive(page: Page): Promise<void> {
    const recorder = await page.evaluate(() => {
      return window.onbored._getRecorder();
    });
    expect(recorder).toBeDefined();
  },

  async assertEventsRecorded(page: Page): Promise<void> {
    const events = await page.evaluate(() => {
      return window.onbored._getRecorderEvents();
    });
    expect(events.length).toBeGreaterThan(0);
  },
};

/**
 * Test utilities
 */
export const TestUtils = {
  /**
   * Wait for a condition to be true
   */
  async waitForCondition(
    page: Page,
    condition: () => Promise<boolean>,
    timeout: number = 5000
  ): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await condition()) {
        return;
      }
      await page.waitForTimeout(100);
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  },

  /**
   * Wait for network to be idle
   */
  async waitForNetworkIdle(page: Page, timeout: number = 5000): Promise<void> {
    await page.waitForLoadState('networkidle', { timeout });
  },

  /**
   * Wait for specific timeout
   */
  async wait(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Generate random string
   */
  generateRandomString(length: number = 10): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * Generate random number
   */
  generateRandomNumber(min: number = 0, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Generate random email
   */
  generateRandomEmail(): string {
    const domains = ['example.com', 'test.com', 'demo.com'];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `test-${Date.now()}@${domain}`;
  },
};
