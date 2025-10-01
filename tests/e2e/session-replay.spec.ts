/// <reference path="../types.d.ts" />
import { test, expect } from '@playwright/test';
import { OnBoredTestHelper } from '../utils/test-helpers';

test.describe('Session Replay', () => {
  let helper: OnBoredTestHelper;

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/test-app.html');
    helper = new OnBoredTestHelper(page);
  });

  test('should initialize session replay when enabled', async () => {
    await helper.initializeSDK({
      sessionReplay: true,
      apiHost: 'http://localhost:3000',
    });

    await helper.assertSessionReplayActive();
  });

  test('should not initialize session replay when disabled', async ({
    page,
  }) => {
    await helper.initializeSDK({
      sessionReplay: false,
    });

    const recorder = await page.evaluate(() => {
      return window.onbored._getRecorder();
    });

    expect(recorder).toBeNull();
  });

  test('should record user interactions', async ({ page }) => {
    await helper.initializeSDK({
      sessionReplay: true,
      apiHost: 'http://localhost:3000',
    });

    await helper.simulateUserInteraction();
    await page.waitForTimeout(500);

    await helper.assertEventsRecorded();
  });

  test('should record DOM mutations', async ({ page }) => {
    await helper.initializeSDK({
      sessionReplay: true,
      apiHost: 'http://localhost:3000',
    });

    await page.evaluate(() => {
      const div = document.createElement('div');
      div.textContent = 'Dynamic content';
      document.body.appendChild(div);
    });

    await page.waitForTimeout(500);
    await helper.assertEventsRecorded();
  });

  test('should handle visibility changes', async ({ page }) => {
    await helper.initializeSDK({
      sessionReplay: true,
      apiHost: 'http://localhost:3000',
    });

    await helper.simulateVisibilityChange('hidden');
    await page.waitForTimeout(100);
    await helper.simulateVisibilityChange('visible');

    const events = await helper.getRecorderEvents();
    expect(events.length).toBeGreaterThan(0);
  });
});
