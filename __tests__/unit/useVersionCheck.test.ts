import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Platform, AppState } from 'react-native';

const mockGetMinVersion = jest.fn();

jest.mock('../../lib/api', () => ({
  appConfigApi: { getMinVersion: () => mockGetMinVersion() },
}));

jest.mock('../../utils/version', () => ({
  isVersionOutdated: jest.requireActual('../../utils/version').isVersionOutdated,
}));

let mockUser: { id: string } | null = null;

jest.mock('../../lib/auth-context', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.0.0' },
  },
}));

import { useVersionCheck } from '../../hooks/useVersionCheck';

function renderHook<T>(hookFn: () => T) {
  let result: { current: T } = {} as any;
  let renderer: ReactTestRenderer;

  function TestComponent() {
    result.current = hookFn();
    return null;
  }

  act(() => {
    renderer = create(React.createElement(TestComponent));
  });

  return {
    result,
    unmount: () => act(() => renderer!.unmount()),
    rerender: () => act(() => renderer!.update(React.createElement(TestComponent))),
  };
}

let appStateCallback: ((state: string) => void) | null = null;
const mockRemove = jest.fn();
const originalAddEventListener = AppState.addEventListener;

describe('useVersionCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'user-1' };
    appStateCallback = null;

    AppState.addEventListener = jest.fn((_, callback) => {
      appStateCallback = callback as any;
      return { remove: mockRemove } as any;
    });

    (Platform as any).OS = 'android';
    mockGetMinVersion.mockResolvedValue('1.0.0');
  });

  afterAll(() => {
    AppState.addEventListener = originalAddEventListener;
  });

  it('sets updateRequired = false when current >= minimum', async () => {
    mockGetMinVersion.mockResolvedValue('1.0.0');

    let result: { current: { updateRequired: boolean } };
    await act(async () => {
      const hook = renderHook(() => useVersionCheck());
      result = hook.result;
    });

    expect(result!.current.updateRequired).toBe(false);
  });

  it('sets updateRequired = true when current < minimum', async () => {
    mockGetMinVersion.mockResolvedValue('2.0.0');

    let result: { current: { updateRequired: boolean } };
    await act(async () => {
      const hook = renderHook(() => useVersionCheck());
      result = hook.result;
    });

    expect(result!.current.updateRequired).toBe(true);
  });

  it('fails open on API errors (updateRequired stays false)', async () => {
    mockGetMinVersion.mockRejectedValue(new Error('network error'));

    let result: { current: { updateRequired: boolean } };
    await act(async () => {
      const hook = renderHook(() => useVersionCheck());
      result = hook.result;
    });

    expect(result!.current.updateRequired).toBe(false);
  });

  it('skips on web platform', async () => {
    (Platform as any).OS = 'web';

    await act(async () => {
      renderHook(() => useVersionCheck());
    });

    expect(mockGetMinVersion).not.toHaveBeenCalled();
    expect(AppState.addEventListener).not.toHaveBeenCalled();
  });

  it('re-checks version on foreground transition', async () => {
    (AppState as any).currentState = 'background';

    await act(async () => {
      renderHook(() => useVersionCheck());
    });

    mockGetMinVersion.mockClear();
    mockGetMinVersion.mockResolvedValue('1.0.0');

    await act(async () => {
      appStateCallback!('active');
    });

    expect(mockGetMinVersion).toHaveBeenCalledTimes(1);
  });

  it('re-checks version when user changes', async () => {
    mockUser = null;

    let rerender: () => void;
    await act(async () => {
      const hook = renderHook(() => useVersionCheck());
      rerender = hook.rerender;
    });

    mockGetMinVersion.mockClear();
    mockUser = { id: 'user-2' };

    await act(async () => {
      rerender!();
    });

    expect(mockGetMinVersion).toHaveBeenCalled();
  });
});
