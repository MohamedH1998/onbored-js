/**
 * Mock Server for Testing
 *
 * A comprehensive mock server for OnBored SDK testing including:
 * - API endpoint mocking
 * - Request/response logging
 * - Error simulation
 * - Performance testing
 * - Rate limiting
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';

export interface MockServerConfig {
  port: number;
  host: string;
  delay: number;
  errorRate: number;
  rateLimit: {
    requests: number;
    window: number;
  };
}

export interface MockResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
}

export interface RequestLog {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: any;
  timestamp: number;
  responseTime: number;
}

export class MockServer {
  private server: any;
  private config: MockServerConfig;
  private requestLogs: RequestLog[] = [];
  private requestCounts: Map<string, number> = new Map();
  private rateLimitWindows: Map<string, number[]> = new Map();

  constructor(config: Partial<MockServerConfig> = {}) {
    this.config = {
      port: 3000,
      host: 'localhost',
      delay: 0,
      errorRate: 0,
      rateLimit: {
        requests: 100,
        window: 60000, // 1 minute
      },
      ...config,
    };
  }

  /**
   * Start the mock server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.config.port, this.config.host, (error: any) => {
        if (error) {
          reject(error);
        } else {
          console.log(
            `Mock server running on http://${this.config.host}:${this.config.port}`
          );
          resolve();
        }
      });
    });
  }

  /**
   * Stop the mock server
   */
  async stop(): Promise<void> {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(() => {
          console.log('Mock server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle incoming requests
   */
  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const startTime = Date.now();
    const url = new URL(req.url || '', `http://${req.headers.host}`);

    // Log request
    const requestLog: RequestLog = {
      method: req.method || 'GET',
      url: url.pathname,
      headers: req.headers as Record<string, string>,
      body: null,
      timestamp: startTime,
      responseTime: 0,
    };

    // Parse request body
    if (req.method === 'POST' || req.method === 'PUT') {
      requestLog.body = await this.parseRequestBody(req);
    }

    // Check rate limiting
    if (this.isRateLimited(req)) {
      this.sendResponse(res, {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Rate limit exceeded' },
      });
      return;
    }

    // Simulate delay
    if (this.config.delay > 0) {
      await this.delay(this.config.delay);
    }

    // Simulate errors
    if (this.config.errorRate > 0 && Math.random() < this.config.errorRate) {
      this.sendResponse(res, {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Internal server error' },
      });
      return;
    }

    // Handle different endpoints
    const response = await this.handleEndpoint(req, url);

    // Update request log
    requestLog.responseTime = Date.now() - startTime;
    this.requestLogs.push(requestLog);

    // Send response
    this.sendResponse(res, response);
  }

  /**
   * Handle specific endpoints
   */
  private async handleEndpoint(
    req: IncomingMessage,
    url: URL
  ): Promise<MockResponse> {
    const pathname = url.pathname;
    const method = req.method;

    // Session endpoint
    if (pathname === '/ingest/session' && method === 'POST') {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { status: 'success', sessionId: 'mock-session-id' },
      };
    }

    // Events endpoint
    if (pathname === '/ingest/events' && method === 'POST') {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { status: 'success', processed: true },
      };
    }

    // Flow endpoint
    if (pathname === '/ingest/flow' && method === 'POST') {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { status: 'success', flowId: 'mock-flow-id' },
      };
    }

    // Health check
    if (pathname === '/health' && method === 'GET') {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { status: 'healthy', timestamp: Date.now() },
      };
    }

    // Metrics endpoint
    if (pathname === '/metrics' && method === 'GET') {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          requests: this.requestLogs.length,
          averageResponseTime: this.getAverageResponseTime(),
          errorRate: this.getErrorRate(),
        },
      };
    }

    // Default 404
    return {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Not found' },
    };
  }

  /**
   * Parse request body
   */
  private async parseRequestBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * Send response
   */
  private sendResponse(res: ServerResponse, response: MockResponse): void {
    res.statusCode = response.status;

    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    res.end(JSON.stringify(response.body));
  }

  /**
   * Check if request is rate limited
   */
  private isRateLimited(req: IncomingMessage): boolean {
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientId =
      (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) ||
      req.connection.remoteAddress ||
      'unknown';
    const now = Date.now();
    const windowStart = now - this.config.rateLimit.window;

    if (!this.rateLimitWindows.has(clientId)) {
      this.rateLimitWindows.set(clientId, []);
    }

    const requests = this.rateLimitWindows.get(clientId)!;
    const recentRequests = requests.filter(time => time > windowStart);

    if (recentRequests.length >= this.config.rateLimit.requests) {
      return true;
    }

    recentRequests.push(now);
    this.rateLimitWindows.set(clientId, recentRequests);

    return false;
  }

  /**
   * Get average response time
   */
  private getAverageResponseTime(): number {
    if (this.requestLogs.length === 0) return 0;

    const totalTime = this.requestLogs.reduce(
      (sum, log) => sum + log.responseTime,
      0
    );
    return totalTime / this.requestLogs.length;
  }

  /**
   * Get error rate
   */
  private getErrorRate(): number {
    if (this.requestLogs.length === 0) return 0;

    const errorCount = this.requestLogs.filter(
      log => log.responseTime > 1000
    ).length;
    return errorCount / this.requestLogs.length;
  }

  /**
   * Get request logs
   */
  getRequestLogs(): RequestLog[] {
    return [...this.requestLogs];
  }

  /**
   * Clear request logs
   */
  clearRequestLogs(): void {
    this.requestLogs = [];
  }

  /**
   * Get request count for endpoint
   */
  getRequestCount(endpoint: string): number {
    return this.requestCounts.get(endpoint) || 0;
  }

  /**
   * Simulate delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MockServerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Simulate network conditions
   */
  simulateNetworkConditions(condition: 'fast' | 'slow' | 'unstable'): void {
    switch (condition) {
      case 'fast':
        this.config.delay = 0;
        this.config.errorRate = 0;
        break;
      case 'slow':
        this.config.delay = 2000;
        this.config.errorRate = 0;
        break;
      case 'unstable':
        this.config.delay = 1000;
        this.config.errorRate = 0.1;
        break;
    }
  }

  /**
   * Simulate server errors
   */
  simulateErrors(errorRate: number): void {
    this.config.errorRate = errorRate;
  }

  /**
   * Simulate rate limiting
   */
  simulateRateLimit(requests: number, window: number): void {
    this.config.rateLimit = { requests, window };
  }

  /**
   * Reset server state
   */
  reset(): void {
    this.requestLogs = [];
    this.requestCounts.clear();
    this.rateLimitWindows.clear();
  }
}

/**
 * Test server factory
 */
export class TestServerFactory {
  private static servers: Map<string, MockServer> = new Map();

  /**
   * Create a test server
   */
  static async createServer(
    name: string,
    config: Partial<MockServerConfig> = {}
  ): Promise<MockServer> {
    const server = new MockServer(config);
    await server.start();
    this.servers.set(name, server);
    return server;
  }

  /**
   * Get a test server
   */
  static getServer(name: string): MockServer | undefined {
    return this.servers.get(name);
  }

  /**
   * Stop a test server
   */
  static async stopServer(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (server) {
      await server.stop();
      this.servers.delete(name);
    }
  }

  /**
   * Stop all test servers
   */
  static async stopAllServers(): Promise<void> {
    const promises = Array.from(this.servers.values()).map(server =>
      server.stop()
    );
    await Promise.all(promises);
    this.servers.clear();
  }
}

/**
 * Test server utilities
 */
export const TestServerUtils = {
  /**
   * Create a basic test server
   */
  async createBasicServer(port: number = 3000): Promise<MockServer> {
    return TestServerFactory.createServer('basic', { port });
  },

  /**
   * Create a slow test server
   */
  async createSlowServer(port: number = 3001): Promise<MockServer> {
    return TestServerFactory.createServer('slow', {
      port,
      delay: 2000,
      errorRate: 0.1,
    });
  },

  /**
   * Create a rate-limited test server
   */
  async createRateLimitedServer(port: number = 3002): Promise<MockServer> {
    return TestServerFactory.createServer('rate-limited', {
      port,
      rateLimit: {
        requests: 10,
        window: 60000,
      },
    });
  },

  /**
   * Create an unstable test server
   */
  async createUnstableServer(port: number = 3003): Promise<MockServer> {
    return TestServerFactory.createServer('unstable', {
      port,
      delay: 1000,
      errorRate: 0.3,
    });
  },
};
