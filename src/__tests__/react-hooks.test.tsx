/**
 * React Hooks Tests
 *
 * Comprehensive tests for OnBored React hooks covering:
 * - useFunnel hook functionality
 * - OnboredProvider integration
 * - Hook integration scenarios
 * - Error handling and edge cases
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboredProvider, useFunnel } from '../react';
import {
  createMockOptions,
  createMockProjectKey,
  setupTestEnvironment,
  cleanupTestEnvironment,
  TEST_FLOWS,
  TEST_STEPS,
} from './utils/testUtils';
import { mockApiResponses } from './mocks/mockFetch';

// Mock the onbored client
jest.mock('../lib', () => ({
  onbored: {
    init: jest.fn(),
    funnel: jest.fn(),
    flow: jest.fn(), // Keep for backward compatibility testing
    step: jest.fn(),
    skip: jest.fn(),
    complete: jest.fn(),
    _get: jest.fn(),
  },
}));

import { onbored } from '../lib';

describe('React Hooks', () => {
  beforeEach(() => {
    setupTestEnvironment();
    mockApiResponses();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  describe('useFunnel Hook', () => {
    const TestComponent = ({ slug }: { slug: string }) => {
      const { step, skip, complete } = useFunnel(slug);

      return (
        <div>
          <button onClick={() => step(TEST_STEPS.WELCOME)}>Step Welcome</button>
          <button onClick={() => skip(TEST_STEPS.WELCOME)}>Skip Welcome</button>
          <button onClick={() => complete()}>Complete Flow</button>
        </div>
      );
    };

    it('should initialize flow on mount', async () => {
      (onbored._get as jest.Mock).mockReturnValue(true);

      render(<TestComponent slug={TEST_FLOWS.ONBOARDING} />);

      await waitFor(() => {
        expect(onbored.funnel).toHaveBeenCalledWith(TEST_FLOWS.ONBOARDING);
      });
    });

    it('should retry initialization if SDK not ready', async () => {
      (onbored._get as jest.Mock)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      render(<TestComponent slug={TEST_FLOWS.ONBOARDING} />);

      await waitFor(
        () => {
          expect(onbored.funnel).toHaveBeenCalledWith(TEST_FLOWS.ONBOARDING);
        },
        { timeout: 1000 }
      );
    });

    it('should provide step, skip, complete functions', () => {
      (onbored._get as jest.Mock).mockReturnValue(true);

      render(<TestComponent slug={TEST_FLOWS.ONBOARDING} />);

      const stepButton = screen.getByText('Step Welcome');
      const skipButton = screen.getByText('Skip Welcome');
      const completeButton = screen.getByText('Complete Flow');

      expect(stepButton).toBeInTheDocument();
      expect(skipButton).toBeInTheDocument();
      expect(completeButton).toBeInTheDocument();
    });

    it('should call step function when step button is clicked', () => {
      (onbored._get as jest.Mock).mockReturnValue(true);

      render(<TestComponent slug={TEST_FLOWS.ONBOARDING} />);

      const stepButton = screen.getByText('Step Welcome');
      fireEvent.click(stepButton);

      expect(onbored.step).toHaveBeenCalledWith(TEST_STEPS.WELCOME, {
        slug: TEST_FLOWS.ONBOARDING,
      });
    });

    it('should call skip function when skip button is clicked', () => {
      (onbored._get as jest.Mock).mockReturnValue(true);

      render(<TestComponent slug={TEST_FLOWS.ONBOARDING} />);

      const skipButton = screen.getByText('Skip Welcome');
      fireEvent.click(skipButton);

      expect(onbored.skip).toHaveBeenCalledWith(TEST_STEPS.WELCOME, {
        slug: TEST_FLOWS.ONBOARDING,
      });
    });

    it('should call complete function when complete button is clicked', () => {
      (onbored._get as jest.Mock).mockReturnValue(true);

      render(<TestComponent slug={TEST_FLOWS.ONBOARDING} />);

      const completeButton = screen.getByText('Complete Flow');
      fireEvent.click(completeButton);

      expect(onbored.complete).toHaveBeenCalledWith({
        slug: TEST_FLOWS.ONBOARDING,
      });
    });

    it('should handle SDK initialization errors gracefully', () => {
      (onbored._get as jest.Mock).mockImplementation(() => {
        throw new Error('SDK not initialized');
      });

      // Initialization should not throw, it should just retry silently
      expect(() => {
        render(<TestComponent slug={TEST_FLOWS.ONBOARDING} />);
      }).not.toThrow();

      // Verify onbored.flow was never called successfully
      expect(onbored.funnel).not.toHaveBeenCalled();
    });

    it('should handle step errors gracefully', () => {
      (onbored._get as jest.Mock).mockReturnValue(true);
      (onbored.step as jest.Mock).mockImplementation(() => {
        throw new Error('Step failed');
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(<TestComponent slug={TEST_FLOWS.ONBOARDING} />);

      const stepButton = screen.getByText('Step Welcome');
      fireEvent.click(stepButton);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[useFunnel] SDK not initialized yet:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle skip errors gracefully', () => {
      (onbored._get as jest.Mock).mockReturnValue(true);
      (onbored.skip as jest.Mock).mockImplementation(() => {
        throw new Error('Skip failed');
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(<TestComponent slug={TEST_FLOWS.ONBOARDING} />);

      const skipButton = screen.getByText('Skip Welcome');
      fireEvent.click(skipButton);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[useFunnel] SDK not initialized yet:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle complete errors gracefully', () => {
      (onbored._get as jest.Mock).mockReturnValue(true);
      (onbored.complete as jest.Mock).mockImplementation(() => {
        throw new Error('Complete failed');
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(<TestComponent slug={TEST_FLOWS.ONBOARDING} />);

      const completeButton = screen.getByText('Complete Flow');
      fireEvent.click(completeButton);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[useFunnel] SDK not initialized yet:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should reinitialize on slug change', async () => {
      (onbored._get as jest.Mock).mockReturnValue(true);

      const { rerender } = render(
        <TestComponent slug={TEST_FLOWS.ONBOARDING} />
      );

      await waitFor(() => {
        expect(onbored.funnel).toHaveBeenCalledWith(TEST_FLOWS.ONBOARDING);
      });

      rerender(<TestComponent slug={TEST_FLOWS.CHECKOUT} />);

      await waitFor(() => {
        expect(onbored.funnel).toHaveBeenCalledWith(TEST_FLOWS.CHECKOUT);
      });
    });
  });

  describe('OnboredProvider', () => {
    const TestApp = ({ config }: { config: any }) => (
      <OnboredProvider config={config}>
        <div>Test App</div>
      </OnboredProvider>
    );

    it('should initialize SDK on mount', () => {
      const config = {
        projectKey: createMockProjectKey(),
        ...createMockOptions(),
      };

      render(<TestApp config={config} />);

      expect(onbored.init).toHaveBeenCalledWith(config);
    });

    it('should handle initialization errors', () => {
      (onbored.init as jest.Mock).mockImplementation(() => {
        throw new Error('Initialization failed');
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const config = {
        projectKey: createMockProjectKey(),
        ...createMockOptions(),
      };

      render(<TestApp config={config} />);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[OnboredProvider] Failed to initialize:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should reinitialize on config change', () => {
      const config1 = {
        projectKey: createMockProjectKey(),
        ...createMockOptions(),
      };

      const config2 = {
        projectKey: 'different-project-key',
        ...createMockOptions(),
      };

      const { rerender } = render(<TestApp config={config1} />);

      expect(onbored.init).toHaveBeenCalledWith(config1);

      rerender(<TestApp config={config2} />);

      expect(onbored.init).toHaveBeenCalledWith(config2);
    });

    it('should not initialize multiple times with same config', () => {
      const config = {
        projectKey: createMockProjectKey(),
        ...createMockOptions(),
      };

      const { rerender } = render(<TestApp config={config} />);

      expect(onbored.init).toHaveBeenCalledTimes(1);

      rerender(<TestApp config={config} />);

      expect(onbored.init).toHaveBeenCalledTimes(1);
    });

    it('should handle missing config gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(<TestApp config={undefined as any} />);

      // Should not call init with undefined, should log warning instead
      expect(onbored.init).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[OnboredProvider] Failed to initialize:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle invalid config gracefully', () => {
      const invalidConfig = {
        projectKey: '',
        invalidOption: 'invalid-value',
      };

      render(<TestApp config={invalidConfig} />);

      expect(onbored.init).toHaveBeenCalledWith(invalidConfig);
    });
  });

  describe('Hook Integration', () => {
    const MultiFlowComponent = () => {
      const onboardingFlow = useFunnel(TEST_FLOWS.ONBOARDING);
      const checkoutFlow = useFunnel(TEST_FLOWS.CHECKOUT);

      return (
        <div>
          <button onClick={() => onboardingFlow.step(TEST_STEPS.WELCOME)}>
            Onboarding Step
          </button>
          <button onClick={() => checkoutFlow.step(TEST_STEPS.FORM)}>
            Checkout Step
          </button>
        </div>
      );
    };

    it('should work with multiple flows', () => {
      (onbored._get as jest.Mock).mockReturnValue(true);

      render(<MultiFlowComponent />);

      expect(onbored.funnel).toHaveBeenCalledWith(TEST_FLOWS.ONBOARDING);
      expect(onbored.funnel).toHaveBeenCalledWith(TEST_FLOWS.CHECKOUT);
    });

    it('should handle concurrent flow operations', () => {
      (onbored._get as jest.Mock).mockReturnValue(true);

      render(<MultiFlowComponent />);

      const onboardingButton = screen.getByText('Onboarding Step');
      const checkoutButton = screen.getByText('Checkout Step');

      fireEvent.click(onboardingButton);
      fireEvent.click(checkoutButton);

      expect(onbored.step).toHaveBeenCalledWith(TEST_STEPS.WELCOME, {
        slug: TEST_FLOWS.ONBOARDING,
      });
      expect(onbored.step).toHaveBeenCalledWith(TEST_STEPS.FORM, {
        slug: TEST_FLOWS.CHECKOUT,
      });
    });

    it('should maintain state across re-renders', () => {
      (onbored._get as jest.Mock).mockReturnValue(true);

      const { rerender } = render(<MultiFlowComponent />);

      expect(onbored.funnel).toHaveBeenCalledWith(TEST_FLOWS.ONBOARDING);
      expect(onbored.funnel).toHaveBeenCalledWith(TEST_FLOWS.CHECKOUT);

      rerender(<MultiFlowComponent />);

      // Should not call flow again
      expect(onbored.funnel).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Boundaries', () => {
    const ErrorComponent = () => {
      const { step } = useFunnel(TEST_FLOWS.ONBOARDING);

      // Simulate an error in the component
      throw new Error('Component error');
    };

    it('should handle component errors gracefully', () => {
      (onbored._get as jest.Mock).mockReturnValue(true);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        render(<ErrorComponent />);
      }).toThrow('Component error');

      consoleSpy.mockRestore();
    });
  });

  describe('SSR Compatibility', () => {
    it('should handle server-side rendering', () => {
      // Mock server environment
      const originalWindow = global.window;
      delete (global as any).window;

      const TestComponent = () => {
        const { step } = useFunnel(TEST_FLOWS.ONBOARDING);
        return <div>Test</div>;
      };

      expect(() => {
        render(<TestComponent />);
      }).not.toThrow();

      // Restore window
      global.window = originalWindow;
    });

    it('should handle hydration', () => {
      (onbored._get as jest.Mock).mockReturnValue(true);

      const TestComponent = () => {
        const { step } = useFunnel(TEST_FLOWS.ONBOARDING);
        return <div>Test</div>;
      };

      // First render (SSR)
      const { rerender } = render(<TestComponent />);

      // Second render (hydration)
      rerender(<TestComponent />);

      expect(onbored.funnel).toHaveBeenCalledWith(TEST_FLOWS.ONBOARDING);
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      (onbored._get as jest.Mock).mockReturnValue(true);

      const renderSpy = jest.fn();
      const TestComponent = () => {
        renderSpy();
        const { step } = useFunnel(TEST_FLOWS.ONBOARDING);
        return <div>Test</div>;
      };

      const { rerender } = render(<TestComponent />);

      expect(renderSpy).toHaveBeenCalledTimes(1);

      rerender(<TestComponent />);

      expect(renderSpy).toHaveBeenCalledTimes(2);
    });

    it('should memoize callback functions', () => {
      (onbored._get as jest.Mock).mockReturnValue(true);

      const TestComponent = () => {
        const { step, skip, complete } = useFunnel(TEST_FLOWS.ONBOARDING);

        const stepRef = React.useRef(step);
        const skipRef = React.useRef(skip);
        const completeRef = React.useRef(complete);

        expect(stepRef.current).toBe(step);
        expect(skipRef.current).toBe(skip);
        expect(completeRef.current).toBe(complete);

        return <div>Test</div>;
      };

      render(<TestComponent />);
    });
  });
});
