import { test, expect } from '@playwright/test';
import { OnBoredTestHelper } from '../utils/test-helpers';

test.describe('Cross-Browser Compatibility', () => {
  test('should initialize in all browsers', async ({ page, browserName }) => {
    await page.goto('http://localhost:3000/test-app.html');

    const helper = new OnBoredTestHelper(page);
    await helper.initializeSDK();

    const isInitialized = await page.evaluate(() => {
      return typeof window.onbored !== 'undefined';
    });

    expect(isInitialized).toBe(true);
  });

  test('should create flows in all browsers', async ({ page }) => {
    await page.goto('http://localhost:3000/test-app.html');

    const helper = new OnBoredTestHelper(page);
    await helper.initializeSDK();
    await helper.createFlow('onboarding');

    await helper.assertFlowCreated('onboarding');
  });

  test('should capture events in all browsers', async ({ page }) => {
    await page.goto('http://localhost:3000/test-app.html');

    const helper = new OnBoredTestHelper(page);
    await helper.initializeSDK();
    await helper.captureEvent('test_event', { data: 'test' });

    await helper.assertEventCaptured('test_event');
  });

  test('should handle localStorage in all browsers', async ({ page }) => {
    await page.goto('http://localhost:3000/test-app.html');

    const helper = new OnBoredTestHelper(page);
    await helper.initializeSDK();

    const sessionId = await helper.getSessionId();

    await page.reload();
    await helper.initializeSDK();

    const newSessionId = await helper.getSessionId();
    expect(sessionId).toBe(newSessionId);
  });

  test('should work with different viewport sizes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // Mobile
    await page.goto('http://localhost:3000/test-app.html');

    const helper = new OnBoredTestHelper(page);
    await helper.initializeSDK();
    await helper.createFlow('mobile-flow');

    await helper.assertFlowCreated('mobile-flow');

    await page.setViewportSize({ width: 1920, height: 1080 }); // Desktop
    await helper.createFlow('desktop-flow');

    await helper.assertFlowCreated('desktop-flow');
  });
});
