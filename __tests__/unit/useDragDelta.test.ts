import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { PanResponder, PanResponderGestureState } from 'react-native';

// Capture the callbacks passed to PanResponder.create
let capturedCallbacks: Record<string, Function> = {};
const originalCreate = PanResponder.create;

jest.spyOn(PanResponder, 'create').mockImplementation((config: any) => {
  capturedCallbacks = config;
  // Return a minimal panResponder with panHandlers stub
  return {
    panHandlers: { _stubbed: true },
  } as any;
});

import { useDragDelta } from '../../hooks/useDragDelta';

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

const makeDimensions = (width = 400, height = 800) => () => ({ width, height });

// Helpers to simulate PanResponder lifecycle
function simulateGrant() {
  capturedCallbacks.onPanResponderGrant?.({}, {});
}

function simulateMove(dx: number, dy: number) {
  capturedCallbacks.onPanResponderMove?.({}, { dx, dy } as PanResponderGestureState);
}

function simulateRelease() {
  capturedCallbacks.onPanResponderRelease?.({}, {});
}

describe('useDragDelta', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedCallbacks = {};
  });

  it('starts inactive with zero delta', () => {
    const { result } = renderHook(() =>
      useDragDelta({ getDimensions: makeDimensions() })
    );

    expect(result.current.isActive).toBe(false);
    expect(result.current.delta).toEqual({ x: 0, y: 0 });
  });

  it('activates on start() and resets delta', () => {
    const { result } = renderHook(() =>
      useDragDelta({ getDimensions: makeDimensions() })
    );

    act(() => result.current.start());

    expect(result.current.isActive).toBe(true);
    expect(result.current.delta).toEqual({ x: 0, y: 0 });
  });

  it('cancel() deactivates and resets delta', () => {
    const { result } = renderHook(() =>
      useDragDelta({ getDimensions: makeDimensions() })
    );

    act(() => result.current.start());
    act(() => result.current.cancel());

    expect(result.current.isActive).toBe(false);
    expect(result.current.delta).toEqual({ x: 0, y: 0 });
  });

  it('complete() returns final delta and resets state', () => {
    const { result } = renderHook(() =>
      useDragDelta({ getDimensions: makeDimensions() })
    );

    act(() => result.current.start());

    act(() => {
      simulateGrant();
      simulateMove(40, 80);
    });

    let finalDelta: { x: number; y: number };
    act(() => {
      finalDelta = result.current.complete();
    });

    // dx=40 on width=400 => 10%, dy=80 on height=800 => 10%
    expect(finalDelta!.x).toBeCloseTo(10);
    expect(finalDelta!.y).toBeCloseTo(10);
    expect(result.current.isActive).toBe(false);
    expect(result.current.delta).toEqual({ x: 0, y: 0 });
  });

  it('converts pixel delta to percentage using getDimensions', () => {
    const { result } = renderHook(() =>
      useDragDelta({ getDimensions: makeDimensions(200, 500) })
    );

    act(() => result.current.start());

    act(() => {
      simulateGrant();
      simulateMove(50, 100);
    });

    // dx=50 on width=200 => 25%, dy=100 on height=500 => 20%
    expect(result.current.delta.x).toBeCloseTo(25);
    expect(result.current.delta.y).toBeCloseTo(20);
  });

  it('applies sensitivity multiplier', () => {
    const { result } = renderHook(() =>
      useDragDelta({ getDimensions: makeDimensions(400, 800), sensitivity: 2.0 })
    );

    act(() => result.current.start());

    act(() => {
      simulateGrant();
      simulateMove(40, 80);
    });

    // Base: 10%, 10% => with sensitivity 2.0: 20%, 20%
    expect(result.current.delta.x).toBeCloseTo(20);
    expect(result.current.delta.y).toBeCloseTo(20);
  });

  it('uses custom calculateDelta when provided', () => {
    const customCalc = jest.fn((_gs: PanResponderGestureState) => ({
      x: 5,
      y: 3,
    }));

    const { result } = renderHook(() =>
      useDragDelta({
        getDimensions: makeDimensions(),
        calculateDelta: customCalc,
      })
    );

    act(() => result.current.start());

    act(() => {
      simulateGrant();
      simulateMove(999, 999);
    });

    expect(customCalc).toHaveBeenCalled();
    expect(result.current.delta.x).toBeCloseTo(5);
    expect(result.current.delta.y).toBeCloseTo(3);
  });

  it('skips move when custom calculateDelta returns null', () => {
    const customCalc = jest.fn(() => null);

    const { result } = renderHook(() =>
      useDragDelta({
        getDimensions: makeDimensions(),
        calculateDelta: customCalc,
      })
    );

    act(() => result.current.start());

    act(() => {
      simulateGrant();
      simulateMove(100, 100);
    });

    expect(result.current.delta).toEqual({ x: 0, y: 0 });
  });

  it('provides panHandlers object', () => {
    const { result } = renderHook(() =>
      useDragDelta({ getDimensions: makeDimensions() })
    );

    expect(result.current.panHandlers).toBeDefined();
  });
});
