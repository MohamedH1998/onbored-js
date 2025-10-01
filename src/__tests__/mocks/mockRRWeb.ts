/**
 * Mock RRWeb Implementation
 *
 * Provides comprehensive mocking of the rrweb session replay library:
 * - Record and stop functionality
 * - Event handling and compression
 * - Snapshot management
 * - Error handling
 */

interface MockRecordOptions {
  emit?: (event: any) => void;
  checkoutEveryNms?: number;
  checkoutEveryNth?: number;
  recordCanvas?: boolean;
  recordCrossOriginIframes?: boolean;
  recordAfter?: string;
  recordBefore?: string;
  sampling?: {
    scroll?: number;
    mouseInteraction?: number;
    input?: number;
  };
  blockClass?: string;
  blockSelector?: string;
  ignoreClass?: string;
  maskAllInputs?: boolean;
  maskInputOptions?: Record<string, boolean>;
  slimDOMOptions?: {
    script?: boolean;
    comment?: boolean;
    headFavicon?: boolean;
    headWhitespace?: boolean;
    headMetaDescKeywords?: boolean;
    headMetaSocial?: boolean;
    headMetaRobots?: boolean;
    headMetaHttpEquiv?: boolean;
    headMetaAuthorship?: boolean;
    headMetaVerification?: boolean;
  };
  inlineStylesheet?: boolean;
  hooks?: {
    beforeEmit?: (event: any) => any;
  };
  packFn?: (event: any) => any;
  plugins?: any[];
}

interface MockRecord {
  stop: jest.Mock;
  takeFullSnapshot: jest.Mock;
  addCustomEvent: jest.Mock;
  freezePage: jest.Mock;
  resumePage: jest.Mock;
}

class MockRRWeb {
  private records: MockRecord[] = [];
  private events: any[] = [];
  private isRecording = false;

  // Mock record function
  mockRecord = jest.fn((options: MockRecordOptions = {}) => {
    const record: MockRecord = {
      stop: jest.fn(() => {
        this.isRecording = false;
        this.records = this.records.filter(r => r !== record);
      }),
      takeFullSnapshot: jest.fn(() => {
        const snapshot = {
          type: 2, // FullSnapshot
          data: {
            node: this.createMockDOMNode(),
            initialOffset: { left: 0, top: 0 },
          },
          timestamp: Date.now(),
        };
        this.events.push(snapshot);
        if (options.emit) {
          options.emit(snapshot);
        }
      }),
      addCustomEvent: jest.fn((tag: string, payload: any) => {
        const event = {
          type: 5, // CustomEvent
          data: { tag, payload },
          timestamp: Date.now(),
        };
        this.events.push(event);
        if (options.emit) {
          options.emit(event);
        }
      }),
      freezePage: jest.fn(),
      resumePage: jest.fn(),
    };

    this.records.push(record);
    this.isRecording = true;

    // Simulate initial snapshot
    setTimeout(() => {
      record.takeFullSnapshot();
    }, 10);

    // Return the stop function as rrweb.record() returns a stop function
    return record.stop;
  });

  // Mock recordWithPlugin function
  mockRecordWithPlugin = jest.fn(
    (plugins: any[], options: MockRecordOptions = {}) => {
      return this.mockRecord(options);
    }
  );

  // Mock addCustomEvent function
  mockAddCustomEvent = jest.fn((tag: string, payload: any) => {
    const event = {
      type: 5, // CustomEvent
      data: { tag, payload },
      timestamp: Date.now(),
    };
    this.events.push(event);
  });

  // Mock getRecordSequentialId function
  mockGetRecordSequentialId = jest.fn(() =>
    Math.floor(Math.random() * 1000000)
  );

  // Mock createMockDOMNode function
  private createMockDOMNode() {
    return {
      type: 0, // Element
      tagName: 'html',
      attributes: {},
      childNodes: [
        {
          type: 0,
          tagName: 'head',
          attributes: {},
          childNodes: [
            {
              type: 0,
              tagName: 'title',
              attributes: {},
              childNodes: [
                {
                  type: 1, // Text
                  textContent: 'Test Page',
                },
              ],
            },
          ],
        },
        {
          type: 0,
          tagName: 'body',
          attributes: {},
          childNodes: [
            {
              type: 0,
              tagName: 'div',
              attributes: { id: 'app' },
              childNodes: [],
            },
          ],
        },
      ],
    };
  }

  // Get recorded events
  getEvents() {
    return [...this.events];
  }

  // Clear events
  clearEvents() {
    this.events = [];
  }

  // Get active records
  getActiveRecords() {
    return [...this.records];
  }

  // Check if recording
  isCurrentlyRecording() {
    return this.isRecording;
  }

  // Reset all mocks
  reset() {
    this.records = [];
    this.events = [];
    this.isRecording = false;
    this.mockRecord.mockClear();
    this.mockRecordWithPlugin.mockClear();
    this.mockAddCustomEvent.mockClear();
    this.mockGetRecordSequentialId.mockClear();
  }
}

let mockRRWebInstance: MockRRWeb;

export function mockRRWeb() {
  mockRRWebInstance = new MockRRWeb();

  // Mock rrweb module
  jest.doMock('rrweb', () => ({
    record: mockRRWebInstance.mockRecord,
    recordWithPlugin: mockRRWebInstance.mockRecordWithPlugin,
    addCustomEvent: mockRRWebInstance.mockAddCustomEvent,
    getRecordSequentialId: mockRRWebInstance.mockGetRecordSequentialId,
    EventType: {
      DomContentLoaded: 0,
      Load: 1,
      FullSnapshot: 2,
      IncrementalSnapshot: 3,
      Meta: 4,
      Custom: 5,
      Plugin: 6,
    },
    IncrementalSource: {
      Mutation: 0,
      MouseMove: 1,
      MouseInteraction: 2,
      Scroll: 3,
      ViewportResize: 4,
      Input: 5,
      TouchMove: 6,
      MediaInteraction: 7,
      StyleSheetRule: 8,
      CanvasMutation: 9,
      Font: 10,
      Selection: 11,
      AdoptedStyleSheet: 12,
    },
    MouseInteractions: {
      MouseUp: 0,
      MouseDown: 1,
      Click: 2,
      ContextMenu: 3,
      DblClick: 4,
      Focus: 5,
      Blur: 6,
      TouchStart: 7,
      TouchEnd: 8,
      TouchMove: 9,
    },
  }));

  // Mock pako compression
  jest.doMock('pako', () => ({
    gzip: jest.fn(data => new Uint8Array(data.length)),
    ungzip: jest.fn(data => new Uint8Array(data.length)),
  }));
}

export function getMockRRWeb() {
  return mockRRWebInstance;
}

export function mockRRWebEvents() {
  if (!mockRRWebInstance) return;

  // Simulate some mock events
  const mockEvents = [
    {
      type: 2, // FullSnapshot
      data: {
        node: mockRRWebInstance['createMockDOMNode'](),
        initialOffset: { left: 0, top: 0 },
      },
      timestamp: Date.now(),
    },
    {
      type: 3, // IncrementalSnapshot
      data: {
        source: 2, // MouseInteraction
        type: 2, // Click
        x: 100,
        y: 200,
      },
      timestamp: Date.now() + 100,
    },
  ];

  mockEvents.forEach(event => {
    mockRRWebInstance['events'].push(event);
  });
}

export function mockRRWebError() {
  if (!mockRRWebInstance) return;

  // Mock record function to throw error
  mockRRWebInstance.mockRecord.mockImplementation(() => {
    throw new Error('RRWeb initialization failed');
  });
}
