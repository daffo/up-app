import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

let mockUser: { id: string } | null = null;
const mockSignOut = jest.fn();

jest.mock('../../lib/auth-context', () => ({
  useAuth: () => ({ user: mockUser, signOut: mockSignOut }),
}));

import { useRequireAuth } from '../../hooks/useRequireAuth';

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

describe('useRequireAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
  });

  it('navigates to Login when user is null', () => {
    mockUser = null;
    const { result } = renderHook(() => useRequireAuth());

    const action = jest.fn();
    result.current.requireAuth(action);

    expect(mockNavigate).toHaveBeenCalledWith('Login', { redirectTo: undefined });
    expect(action).not.toHaveBeenCalled();
  });

  it('executes action when user exists', () => {
    mockUser = { id: 'user-1' };
    const { result } = renderHook(() => useRequireAuth());

    const action = jest.fn();
    result.current.requireAuth(action);

    expect(action).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('passes redirectTo param to Login navigation', () => {
    mockUser = null;
    const { result } = renderHook(() => useRequireAuth());

    const action = jest.fn();
    result.current.requireAuth(action, 'RouteDetail' as any);

    expect(mockNavigate).toHaveBeenCalledWith('Login', { redirectTo: 'RouteDetail' });
  });

  it('returns user and signOut from useAuth', () => {
    mockUser = { id: 'user-1' };
    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.user).toEqual({ id: 'user-1' });
    expect(result.current.signOut).toBe(mockSignOut);
  });
});
