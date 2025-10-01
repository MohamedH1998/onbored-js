/**
 * Mock Storage Implementation
 *
 * Provides realistic localStorage and sessionStorage mocks that:
 * - Persist data across operations
 * - Handle edge cases like quota exceeded
 * - Support storage events
 * - Maintain realistic behavior
 */

interface StorageMock {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
  clear: jest.Mock;
  key: jest.Mock;
  length: number;
}

class MockStorage implements StorageMock {
  private data = new Map<string, string>();

  getItem = jest.fn((key: string) => {
    return this.data.get(key) || null;
  });

  setItem = jest.fn((key: string, value: string) => {
    // Simulate quota exceeded error
    if (this.data.size > 1000) {
      throw new DOMException('QuotaExceededError');
    }
    this.data.set(key, value);
  });

  removeItem = jest.fn((key: string) => {
    this.data.delete(key);
  });

  clear = jest.fn(() => {
    this.data.clear();
  });

  key = jest.fn((index: number) => {
    const keys = Array.from(this.data.keys());
    return keys[index] || null;
  });

  get length() {
    return this.data.size;
  }
}

let mockLocalStorage: MockStorage;
let mockSessionStorage: MockStorage;

export function mockStorage() {
  mockLocalStorage = new MockStorage();
  mockSessionStorage = new MockStorage();

  // Mock localStorage
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  });

  // Mock sessionStorage
  Object.defineProperty(window, 'sessionStorage', {
    value: mockSessionStorage,
    writable: true,
  });

  // Mock storage events - simplified to avoid type issues
  const dispatchStorageEvent = (
    key: string,
    newValue: string | null,
    oldValue: string | null
  ) => {
    // Create a basic storage event without storageArea to avoid type issues
    const event = new StorageEvent('storage', {
      key,
      newValue,
      oldValue,
      // Remove storageArea to avoid type conflicts
    });
    window.dispatchEvent(event);
  };

  // Override setItem to dispatch storage events
  const originalSetItem = mockLocalStorage.setItem;
  mockLocalStorage.setItem = jest.fn((key: string, value: string) => {
    const oldValue = mockLocalStorage.getItem(key);
    originalSetItem.call(mockLocalStorage, key, value);
    dispatchStorageEvent(key, value, oldValue);
  });

  const originalRemoveItem = mockLocalStorage.removeItem;
  mockLocalStorage.removeItem = jest.fn((key: string) => {
    const oldValue = mockLocalStorage.getItem(key);
    originalRemoveItem.call(mockLocalStorage, key);
    dispatchStorageEvent(key, null, oldValue);
  });
}

export function getMockStorage() {
  return {
    localStorage: mockLocalStorage,
    sessionStorage: mockSessionStorage,
  };
}

export function clearMockStorage() {
  mockLocalStorage?.clear();
  mockSessionStorage?.clear();
}
