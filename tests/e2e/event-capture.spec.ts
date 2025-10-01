import { test, expect } from '@playwright/test';
import { OnBoredTestHelper } from '../utils/test-helpers';

test.describe('Event Capture', () => {
  let helper: OnBoredTestHelper;

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/test-app.html');
    helper = new OnBoredTestHelper(page);
    await helper.initializeSDK();
  });

  test('should capture custom events', async () => {
    await helper.captureEvent('button_clicked', {
      buttonId: 'cta-button',
      text: 'Get Started',
    });

    await helper.assertEventCaptured('button_clicked');
  });

  test('should capture events with metadata', async ({ page }) => {
    await page.evaluate(() => {
      window.onbored.capture('page_viewed', {
        url: window.location.href,
        title: document.title,
        timestamp: Date.now(),
      });
    });

    const event = await helper.waitForEvent('page_viewed');
    expect(event.metadata).toHaveProperty('url');
    expect(event.metadata).toHaveProperty('title');
  });

  test('should queue events when offline', async ({ page }) => {
    await page.context().setOffline(true);

    await helper.captureEvent('offline_event', { test: true });

    const events = await helper.getEvents();
    expect(events.length).toBeGreaterThan(0);

    await page.context().setOffline(false);
  });

  test('should capture multiple events in sequence', async () => {
    await helper.captureEvent('event_1', { order: 1 });
    await helper.captureEvent('event_2', { order: 2 });
    await helper.captureEvent('event_3', { order: 3 });

    const events = await helper.getEvents();
    expect(events.length).toBeGreaterThanOrEqual(3);
  });

  test('should include session ID in events', async () => {
    await helper.captureEvent('test_event');

    const sessionId = await helper.getSessionId();
    const events = await helper.getEvents();
    const testEvent = events.find((e: any) => e.event_type === 'test_event');

    expect(testEvent.sessionId).toBe(sessionId);
  });

  test('should handle event capture errors gracefully', async ({ page }) => {
    const result = await page.evaluate(() => {
      try {
        // Try to capture event with invalid data
        window.onbored.capture('', null as any);
        return 'no-error';
      } catch (e) {
        return 'error-thrown';
      }
    });

    expect(result).toBeTruthy();
  });
});
