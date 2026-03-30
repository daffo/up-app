import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Platform, AppState } from 'react-native';

const mockUpsert = jest.fn().mockResolvedValue(undefined);

jest.mock('../../lib/api', () => ({
  userActivityApi: { upsert: (...args: any[]) => mockUpsert(...args) },
}));

let mockUser: { id: string } | null = null;

jest.mock('../../lib/auth-context', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.2.3' },
  },
}));

import { useActivityTracker } from '../../hooks/useActivityTracker';

function renderHook(hookFn: () => void) {
  let renderer: ReactTestRenderer;

  function TestComponent() {
    hookFn();
    return null;
  }

  act(() => {
    renderer = create(React.createElement(TestComponent));
  });

  return {
    unmount: () => act(() => renderer!.unmount()),
    rerender: () => act(() => renderer!.update(React.createElement(TestComponent))),
  };
}

// Capture AppState.addEventListener calls
let appStateCallback: ((state: string) => void) | null = null;
const mockRemove = jest.fn();

const originalAddEventListener = AppState.addEventListener;

describe('useActivityTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
    appStateCallback = null;

    // Mock AppState.addEventListener to capture the callback
    AppState.addEventListener = jest.fn((_, callback) => {
      appStateCallback = callback as any;
      return { remove: mockRemove } as any;
    });

    // Default to native platform
    (Platform as any).OS = 'android';
    (Platform as any).Version = 33;
  });

  afterAll(() => {
    AppState.addEventListener = originalAddEventListener;
  });

  it('skips tracking on web platform', () => {
    (Platform as any).OS = 'web';
    mockUser = { id: 'user-1' };

    renderHook(() => useActivityTracker());

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(AppState.addEventListener).not.toHaveBeenCalled();
  });

  it('calls upsert on mount when user exists', () => {
    mockUser = { id: 'user-1' };

    renderHook(() => useActivityTracker());

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        platform: 'android',
        app_version: '1.2.3',
      })
    );
  });

  it('does not track when user is null', () => {
    mockUser = null;

    renderHook(() => useActivityTracker());

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('calls upsert on app foreground transition', () => {
    mockUser = { id: 'user-1' };
    // Set initial state to background
    (AppState as any).currentState = 'background';

    renderHook(() => useActivityTracker());

    // Clear the mount call
    mockUpsert.mockClear();

    // Simulate returning to foreground
    act(() => {
      appStateCallback!('active');
    });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('does not call upsert on active-to-background transition', () => {
    mockUser = { id: 'user-1' };
    (AppState as any).currentState = 'active';

    renderHook(() => useActivityTracker());
    mockUpsert.mockClear();

    act(() => {
      appStateCallback!('background');
    });

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('removes subscription on unmount', () => {
    mockUser = { id: 'user-1' };

    const { unmount } = renderHook(() => useActivityTracker());
    unmount();

    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});
