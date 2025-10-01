/**
 * Mock Fetch Implementation using MSW (Mock Service Worker)
 *
 * Provides comprehensive fetch mocking that:
 * - Handles different HTTP methods and status codes
 * - Supports request/response inspection
 * - Simulates network errors, timeouts, and rate limiting
 * - Maintains request history for assertions
 * - More realistic network boundary mocking than naive mocks
 */

import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';

interface MockRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  timestamp: number;
}

class MockFetchManager {
  private requests: MockRequest[] = [];
  private requestCallbacks: Array<(req: MockRequest) => void> = [];

  // Track requests
  addRequest(request: MockRequest) {
    this.requests.push(request);
    this.requestCallbacks.forEach(cb => cb(request));
  }

  // Get request history
  getRequests(): MockRequest[] {
    return [...this.requests];
  }

  // Get requests for specific URL
  getRequestsForUrl(url: string): MockRequest[] {
    return this.requests.filter(req => req.url.includes(url));
  }

  // Clear request history
  clearRequests() {
    this.requests = [];
  }

  // Subscribe to requests
  onRequest(callback: (req: MockRequest) => void) {
    this.requestCallbacks.push(callback);
  }

  // Reset
  reset() {
    this.requests = [];
    this.requestCallbacks = [];
  }
}

const mockFetchManager = new MockFetchManager();

// Default successful handlers
const defaultHandlers = [
  http.post('http://localhost:3000/ingest/session', async ({ request }) => {
    const body = await request.text();
    mockFetchManager.addRequest({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
    });

    await delay(10);
    return HttpResponse.json({ status: 'success' }, { status: 200 });
  }),

  http.post('http://localhost:3000/ingest/events', async ({ request }) => {
    const body = await request.text();
    mockFetchManager.addRequest({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
    });

    await delay(10);
    return HttpResponse.json({ status: 'success' }, { status: 200 });
  }),

  http.post('http://localhost:3000/ingest/flow', async ({ request }) => {
    const body = await request.text();
    mockFetchManager.addRequest({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
    });

    await delay(10);
    return HttpResponse.json({ status: 'success' }, { status: 200 });
  }),

  // Production API handlers
  http.post('https://api.onbored.com/ingest/session', async ({ request }) => {
    const body = await request.text();
    mockFetchManager.addRequest({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
    });

    await delay(10);
    return HttpResponse.json({ status: 'success' }, { status: 200 });
  }),

  http.post('https://api.onbored.com/ingest/events', async ({ request }) => {
    const body = await request.text();
    mockFetchManager.addRequest({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
    });

    await delay(10);
    return HttpResponse.json({ status: 'success' }, { status: 200 });
  }),

  http.post('https://api.onbored.com/ingest/flow', async ({ request }) => {
    const body = await request.text();
    mockFetchManager.addRequest({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
    });

    await delay(10);
    return HttpResponse.json({ status: 'success' }, { status: 200 });
  }),
];

// MSW server instance
const server = setupServer(...defaultHandlers);

export function mockFetch() {
  // Start MSW server
  server.listen({ onUnhandledRequest: 'bypass' });

  // Mock navigator.sendBeacon
  Object.defineProperty(navigator, 'sendBeacon', {
    value: jest.fn().mockReturnValue(true),
    writable: true,
  });
}

export function getMockFetch() {
  return mockFetchManager;
}

export function mockApiResponses() {
  // Already set up with default handlers
  server.resetHandlers(...defaultHandlers);
}

export function mockApiErrors() {
  server.use(
    http.post('http://localhost:3000/ingest/session', () => {
      return HttpResponse.error();
    }),
    http.post('http://localhost:3000/ingest/events', () => {
      return HttpResponse.error();
    }),
    http.post('http://localhost:3000/ingest/flow', () => {
      return HttpResponse.error();
    })
  );
}

export function mockApiTimeouts() {
  server.use(
    http.post('http://localhost:3000/ingest/session', async () => {
      await delay(10000); // Long delay to simulate timeout
      return HttpResponse.json({ error: 'Request timeout' }, { status: 408 });
    }),
    http.post('http://localhost:3000/ingest/events', async () => {
      await delay(10000);
      return HttpResponse.json({ error: 'Request timeout' }, { status: 408 });
    })
  );
}

export function mockApiRateLimit() {
  server.use(
    http.post('http://localhost:3000/ingest/session', () => {
      return HttpResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: { 'Retry-After': '60' },
        }
      );
    }),
    http.post('http://localhost:3000/ingest/events', () => {
      return HttpResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: { 'Retry-After': '60' },
        }
      );
    })
  );
}

export function mockApiServerErrors() {
  server.use(
    http.post('http://localhost:3000/ingest/session', () => {
      return HttpResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }),
    http.post('http://localhost:3000/ingest/events', () => {
      return HttpResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    })
  );
}

export function mockApiCORSErrors() {
  server.use(
    http.post('http://localhost:3000/ingest/session', () => {
      return new HttpResponse(null, {
        status: 0,
        statusText: 'CORS error',
      });
    }),
    http.post('http://localhost:3000/ingest/events', () => {
      return new HttpResponse(null, {
        status: 0,
        statusText: 'CORS error',
      });
    })
  );
}

// Custom response handler
export function mockCustomResponse(
  url: string,
  response: {
    status: number;
    body?: any;
    headers?: Record<string, string>;
    delay?: number;
  }
) {
  server.use(
    http.post(url, async () => {
      if (response.delay) {
        await delay(response.delay);
      }
      return HttpResponse.json(response.body || {}, {
        status: response.status,
        ...(response.headers && { headers: response.headers }),
      });
    })
  );
}

// Reset server handlers
export function resetMockHandlers() {
  server.resetHandlers(...defaultHandlers);
  mockFetchManager.clearRequests();
}

// Close server (for cleanup)
export function closeMockServer() {
  server.close();
  mockFetchManager.reset();
}

// Export server for advanced use cases
export { server };
