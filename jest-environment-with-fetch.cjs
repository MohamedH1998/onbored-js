/**
 * Custom Jest environment that sets up fetch globals before loading any modules
 * This is required for MSW v2 to work properly with jsdom
 */
const JSDOMEnvironment = require('jest-environment-jsdom').default;
const { TextEncoder, TextDecoder } = require('util');
const { ReadableStream, TransformStream } = require('stream/web');

class FetchJSDOMEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    // Ensure userAgent is set before calling super to avoid React 19 errors
    const updatedConfig = {
      ...config,
      testEnvironmentOptions: {
        ...config.testEnvironmentOptions,
        url: 'http://localhost',
        userAgent: 'Mozilla/5.0 (darwin) AppleWebKit/537.36 (KHTML, like Gecko) jsdom/30.2.0',
        pretendToBeVisual: true,
      },
    };
    super(updatedConfig, context);
  }

  async setup() {
    await super.setup();

    // Set up text encoding polyfills
    this.global.TextEncoder = TextEncoder;
    this.global.TextDecoder = TextDecoder;
    this.global.ReadableStream = ReadableStream;
    this.global.TransformStream = TransformStream;

    // Set up fetch API from Node.js globals (Node 18+)
    if (typeof globalThis.fetch !== 'undefined') {
      this.global.fetch = globalThis.fetch.bind(globalThis);
      this.global.Request = globalThis.Request;
      this.global.Response = globalThis.Response;
      this.global.Headers = globalThis.Headers;
      this.global.FormData = globalThis.FormData;
    } else {
      throw new Error('fetch API not available - Node 18+ is required for MSW');
    }

    // Set up BroadcastChannel (needed by MSW for WebSocket support)
    if (typeof globalThis.BroadcastChannel !== 'undefined') {
      this.global.BroadcastChannel = globalThis.BroadcastChannel;
    }
  }
}

module.exports = FetchJSDOMEnvironment;