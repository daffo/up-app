import React from "react";
import { Alert } from "react-native";
import { act, create, ReactTestRenderer } from "react-test-renderer";

import { useAuthHandler } from "../../hooks/useAuthHandler";

// Minimal renderHook using react-test-renderer
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
    rerender: () =>
      act(() => renderer!.update(React.createElement(TestComponent))),
  };
}

describe("useAuthHandler", () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it("starts with loading=false", () => {
    const { result } = renderHook(() => useAuthHandler());

    expect(result.current.loading).toBe(false);
  });

  it("sets loading during auth call", async () => {
    let resolveAuth!: (value: { error: null }) => void;
    const slowAuthFn = () =>
      new Promise<{ error: null }>((resolve) => {
        resolveAuth = resolve;
      });

    const { result } = renderHook(() => useAuthHandler());

    act(() => {
      result.current.handleAuth(slowAuthFn, "Failed", jest.fn());
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveAuth({ error: null });
    });

    expect(result.current.loading).toBe(false);
  });

  it("calls onSuccess when auth succeeds", async () => {
    const authFn = jest.fn().mockResolvedValue({ error: null });
    const onSuccess = jest.fn();

    const { result } = renderHook(() => useAuthHandler());

    await act(async () => {
      await result.current.handleAuth(authFn, "Failed", onSuccess);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("shows alert when auth fails", async () => {
    const authFn = jest
      .fn()
      .mockResolvedValue({ error: { message: "Bad password" } });
    const onSuccess = jest.fn();

    const { result } = renderHook(() => useAuthHandler());

    await act(async () => {
      await result.current.handleAuth(authFn, "Login failed", onSuccess);
    });

    expect(Alert.alert).toHaveBeenCalledWith("Login failed", "Bad password");
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
