import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

let mockIsAdmin = false;
let mockLoading = false;

jest.mock('../../lib/auth-context', () => ({
  useAuth: () => ({ isAdmin: mockIsAdmin, loading: mockLoading }),
}));

import { useRequireAdmin } from '../../hooks/useRequireAdmin';

// Minimal renderHook using react-test-renderer (matches existing pattern)
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

describe('useRequireAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdmin = false;
    mockLoading = false;
  });

  it('redirects non-admin user to default fallback route', () => {
    mockIsAdmin = false;
    mockLoading = false;

    renderHook(() => useRequireAdmin());

    expect(mockNavigate).toHaveBeenCalledWith('Home');
  });

  it('does not redirect admin user', () => {
    mockIsAdmin = true;
    mockLoading = false;

    renderHook(() => useRequireAdmin());

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not redirect while loading', () => {
    mockIsAdmin = false;
    mockLoading = true;

    renderHook(() => useRequireAdmin());

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('uses custom fallback route', () => {
    mockIsAdmin = false;
    mockLoading = false;

    renderHook(() => useRequireAdmin('Settings'));

    expect(mockNavigate).toHaveBeenCalledWith('Settings');
  });

  it('returns isAdmin and loading state', () => {
    mockIsAdmin = true;
    mockLoading = false;

    const { result } = renderHook(() => useRequireAdmin());

    expect(result.current).toEqual({ isAdmin: true, loading: false });
  });

  it('redirects when loading transitions from true to false for non-admin', () => {
    mockIsAdmin = false;
    mockLoading = true;

    const { rerender } = renderHook(() => useRequireAdmin());

    expect(mockNavigate).not.toHaveBeenCalled();

    // Simulate loading finishing — user is not admin
    mockLoading = false;
    rerender();

    expect(mockNavigate).toHaveBeenCalledWith('Home');
  });
});
