/**
 * Mock UUID Implementation
 *
 * Provides predictable UUID generation for testing:
 * - Consistent UUIDs for deterministic tests
 * - Configurable UUID patterns
 * - Support for different UUID versions
 */

class MockUUID {
  private customUUIDs: string[] = [];
  private shouldUseCustomUUIDs = false;
  private UUID = '08d353e5-cb8d-4bee-89c0-6a4af6519f03';

  // Mock v4 UUID generator
  mockV4 = jest.fn(() => {
    if (this.shouldUseCustomUUIDs && this.customUUIDs.length > 0) {
      return this.customUUIDs.shift() || this.generateMockUUID();
    }
    return this.generateMockUUID();
  });

  // Generate a mock UUID
  private generateMockUUID(): string {
    return this.UUID;
  }

  // Set custom UUIDs for testing
  setCustomUUIDs(uuids: string[]) {
    this.customUUIDs = [...uuids];
    this.shouldUseCustomUUIDs = true;
  }

  // Use custom UUIDs
  useCustomUUIDs(use: boolean) {
    this.shouldUseCustomUUIDs = use;
  }

  // Reset to default behavior
  reset() {
    this.customUUIDs = [];
    this.shouldUseCustomUUIDs = false;
    this.mockV4.mockClear();
  }

  // Get generated UUIDs
  getGeneratedUUIDs(): string[] {
    return this.mockV4.mock.results.map(result => result.value);
  }
}

let mockUUIDInstance: MockUUID;

export function mockUUID() {
  mockUUIDInstance = new MockUUID();

  // Mock uuid module
  jest.doMock('uuid', () => ({
    v4: mockUUIDInstance.mockV4,
  }));
}

export function getMockUUID() {
  return mockUUIDInstance;
}

export function setCustomUUIDs(uuids: string[]) {
  if (mockUUIDInstance) {
    mockUUIDInstance.setCustomUUIDs(uuids);
  }
}

export function useCustomUUIDs(use: boolean) {
  if (mockUUIDInstance) {
    mockUUIDInstance.useCustomUUIDs(use);
  }
}

export function getGeneratedUUIDs(): string[] {
  return mockUUIDInstance?.getGeneratedUUIDs() || [];
}

export function resetMockUUID() {
  mockUUIDInstance?.reset();
}
