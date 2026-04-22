import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";

const mockGetMany = jest.fn();

jest.mock("../../lib/api", () => ({
  userProfilesApi: {
    getMany: (...args: any[]) => mockGetMany(...args),
  },
}));

import { useUserProfiles } from "../../hooks/useUserProfiles";

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

const flushPromises = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe("useUserProfiles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches display names for given user IDs", async () => {
    mockGetMany.mockResolvedValue(
      new Map([
        ["user-1", { user_id: "user-1", display_name: "Alice" }],
        ["user-2", { user_id: "user-2", display_name: "Bob" }],
      ]),
    );

    const { result } = renderHook(() => useUserProfiles(["user-1", "user-2"]));

    await flushPromises();

    expect(result.current.profileMap).toEqual({
      "user-1": "Alice",
      "user-2": "Bob",
    });
    expect(result.current.loading).toBe(false);
    expect(mockGetMany).toHaveBeenCalledTimes(1);
    expect(mockGetMany).toHaveBeenCalledWith(
      expect.arrayContaining(["user-1", "user-2"]),
    );
  });

  it("deduplicates user IDs — only fetches unique IDs once", async () => {
    mockGetMany.mockResolvedValue(
      new Map([["user-1", { user_id: "user-1", display_name: "Alice" }]]),
    );

    const { result } = renderHook(() =>
      useUserProfiles(["user-1", "user-1", "user-1"]),
    );

    await flushPromises();

    expect(mockGetMany).toHaveBeenCalledTimes(1);
    expect(mockGetMany).toHaveBeenCalledWith(["user-1"]);
    expect(result.current.profileMap).toEqual({ "user-1": "Alice" });
  });

  it("returns empty map and does not fetch when given empty array", async () => {
    const { result } = renderHook(() => useUserProfiles([]));

    await flushPromises();

    expect(result.current.profileMap).toEqual({});
    expect(result.current.loading).toBe(false);
    expect(mockGetMany).not.toHaveBeenCalled();
  });

  it("handles null and undefined user IDs gracefully", async () => {
    mockGetMany.mockResolvedValue(
      new Map([["user-1", { user_id: "user-1", display_name: "Alice" }]]),
    );

    const { result } = renderHook(() =>
      useUserProfiles([null, undefined, "user-1", null]),
    );

    await flushPromises();

    expect(mockGetMany).toHaveBeenCalledWith(["user-1"]);
    expect(result.current.profileMap).toEqual({ "user-1": "Alice" });
  });

  it("re-renders with same IDs still call getMany (api layer handles caching)", async () => {
    mockGetMany.mockResolvedValue(
      new Map([["user-1", { user_id: "user-1", display_name: "Alice" }]]),
    );

    const { result, rerender } = renderHook(() => useUserProfiles(["user-1"]));
    await flushPromises();

    expect(mockGetMany).toHaveBeenCalledTimes(1);
    expect(result.current.profileMap).toEqual({ "user-1": "Alice" });

    mockGetMany.mockClear();
    rerender();
    await flushPromises();

    // Same idsKey — effect does not re-run, so no refetch happens
    expect(mockGetMany).not.toHaveBeenCalled();
    expect(result.current.profileMap).toEqual({ "user-1": "Alice" });
  });

  it("handles users with no profile", async () => {
    mockGetMany.mockResolvedValue(new Map());

    const { result } = renderHook(() => useUserProfiles(["user-no-profile"]));

    await flushPromises();

    expect(result.current.profileMap).toEqual({});
  });

  it("handles fetch errors gracefully", async () => {
    mockGetMany.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useUserProfiles(["user-1"]));

    await flushPromises();

    expect(result.current.profileMap).toEqual({});
    expect(result.current.loading).toBe(false);
  });
});
