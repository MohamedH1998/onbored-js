/**
 * React Test App
 *
 * A comprehensive React test application for OnBored SDK testing including:
 * - OnboredProvider setup
 * - useFlow hook usage
 * - Multiple flow scenarios
 * - Error handling
 * - Performance testing
 */

import React, { useState, useEffect } from 'react';
import { OnboredProvider, useFlow } from '../../src/react';

// Test component for useFlow hook
const FlowTestComponent: React.FC<{ slug: string }> = ({ slug }) => {
  const { step, skip, complete } = useFlow(slug);
  const [stepCount, setStepCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleStep = () => {
    try {
      step(`step-${stepCount}`, { slug });
      setStepCount(prev => prev + 1);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleSkip = () => {
    try {
      skip(`step-${stepCount}`, { slug });
      setStepCount(prev => prev + 1);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleComplete = () => {
    try {
      complete({ slug });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div
      style={{
        margin: '10px 0',
        padding: '10px',
        border: '1px solid #ddd',
        borderRadius: '4px',
      }}
    >
      <h3>Flow: {slug}</h3>
      <p>Step Count: {stepCount}</p>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <button onClick={handleStep} data-testid="step-button">
        Step
      </button>
      <button onClick={handleSkip} data-testid="skip-button">
        Skip
      </button>
      <button onClick={handleComplete} data-testid="complete-button">
        Complete
      </button>
    </div>
  );
};

// Test component for multiple flows
const MultiFlowTestComponent: React.FC = () => {
  const [flows, setFlows] = useState<string[]>([]);
  const [currentFlow, setCurrentFlow] = useState<string>('onboarding');

  const addFlow = (slug: string) => {
    setFlows(prev => [...prev, slug]);
  };

  const removeFlow = (slug: string) => {
    setFlows(prev => prev.filter(f => f !== slug));
  };

  return (
    <div>
      <h2>Multiple Flows Test</h2>
      <div>
        <button
          onClick={() => addFlow('onboarding')}
          data-testid="init-flow-button"
        >
          Add Onboarding Flow
        </button>
        <button
          onClick={() => addFlow('checkout')}
          data-testid="init-checkout-button"
        >
          Add Checkout Flow
        </button>
        <button
          onClick={() => addFlow('signup')}
          data-testid="init-signup-button"
        >
          Add Signup Flow
        </button>
      </div>

      <div>
        <label>
          Current Flow:
          <select
            value={currentFlow}
            onChange={e => setCurrentFlow(e.target.value)}
            data-testid="change-dependency-button"
          >
            <option value="onboarding">Onboarding</option>
            <option value="checkout">Checkout</option>
            <option value="signup">Signup</option>
          </select>
        </label>
      </div>

      {flows.map(slug => (
        <div key={slug}>
          <FlowTestComponent slug={slug} />
          <button onClick={() => removeFlow(slug)}>Remove {slug}</button>
        </div>
      ))}
    </div>
  );
};

// Test component for error handling
const ErrorTestComponent: React.FC = () => {
  const [shouldError, setShouldError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shouldError) {
      throw new Error('Test error');
    }
  }, [shouldError]);

  const triggerError = () => {
    setShouldError(true);
  };

  const handleError = (error: Error) => {
    setError(error.message);
    setShouldError(false);
  };

  if (error) {
    return (
      <div>
        <p>Error caught: {error}</p>
        <button onClick={() => setError(null)}>Clear Error</button>
      </div>
    );
  }

  return (
    <div>
      <h2>Error Handling Test</h2>
      <button onClick={triggerError} data-testid="simulate-error-button">
        Trigger Error
      </button>
    </div>
  );
};

// Test component for performance
const PerformanceTestComponent: React.FC = () => {
  const [renderCount, setRenderCount] = useState(0);
  const [isRendering, setIsRendering] = useState(false);

  const triggerRerender = () => {
    setIsRendering(true);
    setRenderCount(prev => prev + 1);
    setTimeout(() => setIsRendering(false), 100);
  };

  const rapidRerender = () => {
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        setRenderCount(prev => prev + 1);
      }, i * 10);
    }
  };

  return (
    <div>
      <h2>Performance Test</h2>
      <p>Render Count: {renderCount}</p>
      <p>Is Rendering: {isRendering ? 'Yes' : 'No'}</p>
      <button onClick={triggerRerender} data-testid="rerender-button">
        Trigger Rerender
      </button>
      <button onClick={rapidRerender} data-testid="rapid-rerender-button">
        Rapid Rerender
      </button>
    </div>
  );
};

// Test component for mounting/unmounting
const MountTestComponent: React.FC = () => {
  const [isMounted, setIsMounted] = useState(false);

  const mount = () => {
    setIsMounted(true);
  };

  const unmount = () => {
    setIsMounted(false);
  };

  return (
    <div>
      <h2>Mount/Unmount Test</h2>
      <p>Component is {isMounted ? 'mounted' : 'unmounted'}</p>
      <button onClick={mount} data-testid="mount-button">
        Mount Component
      </button>
      <button onClick={unmount} data-testid="unmount-button">
        Unmount Component
      </button>

      {isMounted && <FlowTestComponent slug="onboarding" />}
    </div>
  );
};

// Test component for configuration changes
const ConfigTestComponent: React.FC = () => {
  const [config, setConfig] = useState({
    projectKey: 'test-project-key',
    debug: true,
    env: 'development' as const,
  });

  const changeConfig = () => {
    setConfig(prev => ({
      ...prev,
      projectKey: `test-project-key-${Date.now()}`,
    }));
  };

  return (
    <div>
      <h2>Configuration Test</h2>
      <p>Current Project Key: {config.projectKey}</p>
      <button onClick={changeConfig} data-testid="change-config-button">
        Change Configuration
      </button>

      <OnboredProvider config={config}>
        <FlowTestComponent slug="onboarding" />
      </OnboredProvider>
    </div>
  );
};

// Main test app component
const TestApp: React.FC = () => {
  const [activeTest, setActiveTest] = useState<string>('basic');
  const [testResults, setTestResults] = useState<any[]>([]);

  const runTest = (testName: string) => {
    const start = Date.now();
    // Simulate test execution
    setTimeout(() => {
      const end = Date.now();
      setTestResults(prev => [
        ...prev,
        {
          name: testName,
          duration: end - start,
          status: 'passed',
        },
      ]);
    }, 100);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>OnBored SDK React Test App</h1>

      <div style={{ marginBottom: '20px' }}>
        <h2>Test Selection</h2>
        <button
          onClick={() => setActiveTest('basic')}
          style={{ margin: '5px', padding: '10px' }}
        >
          Basic Flow Test
        </button>
        <button
          onClick={() => setActiveTest('multi')}
          style={{ margin: '5px', padding: '10px' }}
        >
          Multi Flow Test
        </button>
        <button
          onClick={() => setActiveTest('error')}
          style={{ margin: '5px', padding: '10px' }}
        >
          Error Handling Test
        </button>
        <button
          onClick={() => setActiveTest('performance')}
          style={{ margin: '5px', padding: '10px' }}
        >
          Performance Test
        </button>
        <button
          onClick={() => setActiveTest('mount')}
          style={{ margin: '5px', padding: '10px' }}
        >
          Mount/Unmount Test
        </button>
        <button
          onClick={() => setActiveTest('config')}
          style={{ margin: '5px', padding: '10px' }}
        >
          Configuration Test
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Test Controls</h2>
        <button onClick={() => runTest('Basic Test')} style={{ margin: '5px' }}>
          Run Basic Test
        </button>
        <button
          onClick={() => runTest('Performance Test')}
          style={{ margin: '5px' }}
        >
          Run Performance Test
        </button>
        <button onClick={clearResults} style={{ margin: '5px' }}>
          Clear Results
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Test Results</h2>
        {testResults.length === 0 ? (
          <p>No test results yet</p>
        ) : (
          <ul>
            {testResults.map((result, index) => (
              <li key={index}>
                {result.name}: {result.status} ({result.duration}ms)
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Active Test: {activeTest}</h2>
        {activeTest === 'basic' && (
          <OnboredProvider
            config={{
              projectKey: 'test-project-key',
              debug: true,
              env: 'development',
            }}
          >
            <FlowTestComponent slug="onboarding" />
          </OnboredProvider>
        )}

        {activeTest === 'multi' && <MultiFlowTestComponent />}
        {activeTest === 'error' && <ErrorTestComponent />}
        {activeTest === 'performance' && <PerformanceTestComponent />}
        {activeTest === 'mount' && <MountTestComponent />}
        {activeTest === 'config' && <ConfigTestComponent />}
      </div>

      <div
        style={{
          marginTop: '20px',
          padding: '10px',
          backgroundColor: '#f5f5f5',
        }}
      >
        <h3>Test Status</h3>
        <p>
          SDK Status: <span id="sdk-status">Not initialized</span>
        </p>
        <p>
          Test State: <span id="test-state">Ready</span>
        </p>
        <p>
          Error Count: <span id="error-count">0</span>
        </p>
      </div>
    </div>
  );
};

export default TestApp;
