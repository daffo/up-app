import {
  setPendingFallHoldCallback,
  resolvePendingFallHoldCallback,
  clearPendingFallHoldCallback,
  hasPendingFallHoldCallback,
} from "../../lib/fall-hold-picker-bus";

describe("fall-hold-picker-bus", () => {
  afterEach(() => {
    clearPendingFallHoldCallback();
  });

  it("starts with no pending callback", () => {
    expect(hasPendingFallHoldCallback()).toBe(false);
  });

  it("setPending registers a callback", () => {
    setPendingFallHoldCallback(() => {});
    expect(hasPendingFallHoldCallback()).toBe(true);
  });

  it("resolve invokes callback with the id and clears pending", () => {
    const cb = jest.fn();
    setPendingFallHoldCallback(cb);
    resolvePendingFallHoldCallback("hold-1");
    expect(cb).toHaveBeenCalledWith("hold-1");
    expect(hasPendingFallHoldCallback()).toBe(false);
  });

  it("resolve invokes callback with null to clear selection", () => {
    const cb = jest.fn();
    setPendingFallHoldCallback(cb);
    resolvePendingFallHoldCallback(null);
    expect(cb).toHaveBeenCalledWith(null);
  });

  it("resolve is a no-op when no callback pending", () => {
    expect(() => resolvePendingFallHoldCallback("hold-1")).not.toThrow();
  });

  it("resolve cannot fire the same callback twice", () => {
    const cb = jest.fn();
    setPendingFallHoldCallback(cb);
    resolvePendingFallHoldCallback("hold-1");
    resolvePendingFallHoldCallback("hold-2");
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("hold-1");
  });

  it("setPending overwrites a previous pending callback", () => {
    const first = jest.fn();
    const second = jest.fn();
    setPendingFallHoldCallback(first);
    setPendingFallHoldCallback(second);
    resolvePendingFallHoldCallback("hold-1");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("hold-1");
  });

  it("clearPending drops the callback without invoking it", () => {
    const cb = jest.fn();
    setPendingFallHoldCallback(cb);
    clearPendingFallHoldCallback();
    resolvePendingFallHoldCallback("hold-1");
    expect(cb).not.toHaveBeenCalled();
    expect(hasPendingFallHoldCallback()).toBe(false);
  });
});
