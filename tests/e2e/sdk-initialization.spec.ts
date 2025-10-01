import { test, expect } from '@playwright/test';
import { OnBoredTestHelper } from '../utils/test-helpers';

test.describe('SDK Initialization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/test-app.html');
  });

  test('should initialize SDK with valid configuration', async ({ page }) => {
    const helper = new OnBoredTestHelper(page);

    await helper.initializeSDK({
      projectKey: 'test-project-key',
      userId: 'test-user-123',
      debug: true,
    });

    const isInitialized = await page.evaluate(() => {
      return typeof window.onbored !== 'undefined';
    });

    expect(isInitialized).toBe(true);
  });

  test('should throw error when initialized without projectKey', async ({
    page,
  }) => {
    // Wait for SDK to be loaded
    await page.waitForFunction(() => typeof window.onbored !== 'undefined', {
      timeout: 5000,
    });

    const error = await page.evaluate(() => {
      try {
        window.onbored.init({});
        return null;
      } catch (e) {
        return e.message;
      }
    });

    expect(error).toContain('projectKey');
  });

  test('should create session ID on initialization', async ({ page }) => {
    const helper = new OnBoredTestHelper(page);

    await helper.initializeSDK();
    const sessionId = await helper.getSessionId();

    expect(sessionId).toBeTruthy();
    expect(typeof sessionId).toBe('string');
  });

  test('should support debug mode', async ({ page }) => {
    const helper = new OnBoredTestHelper(page);

    await helper.initializeSDK({ debug: true });

    const hasDebug = await page.evaluate(() => {
      return window.onbored._get().debug === true;
    });

    expect(hasDebug).toBe(true);
  });

  test('should handle multiple initialization attempts', async ({ page }) => {
    const helper = new OnBoredTestHelper(page);

    await helper.initializeSDK();

    const warning = await page.evaluate(() => {
      const logs: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args) => {
        logs.push(args.join(' '));
        originalWarn.apply(console, args);
      };

      window.onbored.init({ projectKey: 'test-key' });

      console.warn = originalWarn;
      return logs[0];
    });

    expect(warning).toContain('Already initialized');
  });
});
