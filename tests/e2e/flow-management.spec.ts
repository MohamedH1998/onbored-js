import { test, expect } from '@playwright/test';
import { OnBoredTestHelper } from '../utils/test-helpers';

test.describe('Flow Management', () => {
  let helper: OnBoredTestHelper;

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/test-app.html');
    helper = new OnBoredTestHelper(page);
    await helper.initializeSDK();
  });

  test('should create a flow', async () => {
    await helper.createFlow('onboarding');

    const flowContext = await helper.getFlowContext('onboarding');
    expect(flowContext).toBeDefined();
    expect(flowContext.status).toBe('started');
  });

  test('should capture flow_started event', async () => {
    await helper.createFlow('checkout');

    await helper.assertEventCaptured('flow_started');
  });

  test('should complete a step', async () => {
    await helper.createFlow('onboarding');
    await helper.completeStep('welcome', 'onboarding');

    await helper.assertEventCaptured('step_completed');
  });

  test('should skip a step', async () => {
    await helper.createFlow('onboarding');
    await helper.skipStep('welcome', 'onboarding');

    await helper.assertEventCaptured('step_skipped');
  });

  test('should complete a flow', async () => {
    await helper.createFlow('signup');
    await helper.completeStep('form', 'signup');
    await helper.completeFlow('signup');

    await helper.assertFlowCompleted('signup');
    await helper.assertEventCaptured('flow_complete');
  });

  test('should handle multiple flows concurrently', async () => {
    await helper.createFlow('onboarding');
    await helper.createFlow('checkout');

    const onboardingContext = await helper.getFlowContext('onboarding');
    const checkoutContext = await helper.getFlowContext('checkout');

    expect(onboardingContext).toBeDefined();
    expect(checkoutContext).toBeDefined();
    expect(onboardingContext.status).toBe('started');
    expect(checkoutContext.status).toBe('started');
  });

  test('should complete multiple steps in sequence', async () => {
    await helper.createFlow('onboarding');
    await helper.completeStep('welcome', 'onboarding');
    await helper.completeStep('form', 'onboarding');
    await helper.completeStep('confirmation', 'onboarding');
    await helper.completeFlow('onboarding');

    const events = await helper.getEvents();
    const stepEvents = events.filter(
      (e: any) => e.event_type === 'step_completed'
    );

    expect(stepEvents).toHaveLength(3);
  });

  test('should track flow with metadata', async ({ page }) => {
    await page.evaluate(() => {
      window.onbored.flow('premium-upgrade', {
        plan: 'pro',
        source: 'pricing-page',
      });
    });

    const event = await helper.waitForEvent('flow_started');
    expect(event.metadata).toMatchObject({
      plan: 'pro',
      source: 'pricing-page',
    });
  });
});
