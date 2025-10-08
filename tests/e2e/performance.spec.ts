import { test, expect } from '@playwright/test';
import { OnBoredTestHelper } from '../utils/test-helpers';

test.describe('Performance', () => {
  let helper: OnBoredTestHelper;

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/test-app.html');
    helper = new OnBoredTestHelper(page);
  });

  test('should initialize quickly', async () => {
    const startTime = Date.now();
    await helper.initializeSDK();
    const endTime = Date.now();

    const initTime = endTime - startTime;
    expect(initTime).toBeLessThan(1000);
  });

  test('should handle rapid event capture', async ({ page }) => {
    await helper.initializeSDK();

    const startTime = Date.now();

    await page.evaluate(() => {
      for (let i = 0; i < 100; i++) {
        window.onbored.capture('rapid_event', { index: i });
      }
    });

    const endTime = Date.now();
    const captureTime = endTime - startTime;

    expect(captureTime).toBeLessThan(5000);

    const events = await helper.getEvents();
    expect(events.length).toBeGreaterThanOrEqual(100);
  });

  test('should not cause memory leaks', async () => {
    await helper.initializeSDK();

    const memoryBefore = await helper.getMemoryUsage();

    for (let i = 0; i < 50; i++) {
      await helper.createFlow(`flow-${i}`);
      await helper.completeStep(`step-${i}`, `flow-${i}`);
    }

    const memoryAfter = await helper.getMemoryUsage();

    if (
      memoryBefore &&
      memoryAfter &&
      typeof memoryBefore.usedJSHeapSize === 'number' &&
      typeof memoryAfter.usedJSHeapSize === 'number'
    ) {
      const memoryIncrease =
        memoryAfter.usedJSHeapSize - memoryBefore.usedJSHeapSize;
      expect(memoryIncrease).toBeLessThan(10000000); // Less than 10MB
    } else {
      test.skip();
    }
  });

  test('should handle concurrent flow operations', async ({ page }) => {
    await helper.initializeSDK();

    await page.evaluate(() => {
      const flows = ['flow1', 'flow2', 'flow3', 'flow4', 'flow5'];
      flows.forEach(flow => {
        window.onbored.flow(flow);
        window.onbored.step('step1', { slug: flow });
        window.onbored.step('step2', { slug: flow });
        window.onbored.complete({ slug: flow });
      });
    });

    const events = await helper.getEvents();
    const flowStartedEvents = events.filter(
      (e: any) => e.event_type === 'flow_started'
    );
    const flowCompletedEvents = events.filter(
      (e: any) => e.event_type === 'flow_completed'
    );

    expect(flowStartedEvents).toHaveLength(5);
    expect(flowCompletedEvents).toHaveLength(5);
  });

  test('should not block UI thread', async ({ page }) => {
    await helper.initializeSDK();

    const renderTime = await page.evaluate(() => {
      const start = performance.now();

      for (let i = 0; i < 10; i++) {
        window.onbored.capture('event', { index: i });
      }

      document.body.innerHTML += '<div>Test</div>';

      return performance.now() - start;
    });

    expect(renderTime).toBeLessThan(100);
  });
});
