/**
 * Mock Browser APIs
 *
 * Provides comprehensive mocking of browser APIs including:
 * - History API (pushState, replaceState, popstate)
 * - IntersectionObserver
 * - MutationObserver
 * - Crypto API
 * - Navigator API
 * - Window events
 */

export function mockBrowserAPIs() {
  // Note: Most browser APIs are already mocked in setup.ts
  // This function only resets their state between tests

  // Reset history API mocks
  if (window.history) {
    // Check if the methods exist and have mockClear method
    if (window.history.pushState && 'mockClear' in window.history.pushState) {
      (window.history.pushState as any).mockClear();
    }
    if (
      window.history.replaceState &&
      'mockClear' in window.history.replaceState
    ) {
      (window.history.replaceState as any).mockClear();
    }
  }

  // Reset navigator mocks
  if (globalThis.navigator) {
    if (
      globalThis.navigator.sendBeacon &&
      'mockClear' in globalThis.navigator.sendBeacon
    ) {
      (globalThis.navigator.sendBeacon as any).mockClear();
    }
  }
}

export function mockOnlineStatus(isOnline: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    value: isOnline,
    writable: true,
  });

  // Dispatch online/offline event
  const event = new Event(isOnline ? 'online' : 'offline');
  window.dispatchEvent(event);
}

export function mockVisibilityChange(visibilityState: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    value: visibilityState,
    writable: true,
  });

  const event = new Event('visibilitychange');
  document.dispatchEvent(event);
}

export function mockBeforeUnload() {
  const event = new Event('beforeunload');
  Object.defineProperty(event, 'returnValue', {
    value: '',
    writable: true,
  });
  window.dispatchEvent(event);
}

export function mockPopState() {
  const event = new PopStateEvent('popstate', { state: null });
  window.dispatchEvent(event);
}

export function mockHashChange() {
  const event = new HashChangeEvent('hashchange', {
    oldURL: 'http://localhost:3000',
    newURL: 'http://localhost:3000#new',
  });
  window.dispatchEvent(event);
}
