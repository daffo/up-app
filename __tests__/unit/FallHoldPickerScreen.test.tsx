import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { TouchableOpacity, Text } from "react-native";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("../../lib/theme-context", () => ({
  useThemeColors: () => ({
    primary: "#000",
    screenBackground: "#fff",
  }),
}));

// Mock FullScreenImageBase: expose its key props so the test can invoke them.
jest.mock("../../components/FullScreenImageBase", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockFullScreenImageBase(props: any) {
    (global as any).__fsibProps = props;
    return React.createElement(View, { testID: "fsib" }, props.children);
  };
});

const mockGetWithDetails = jest.fn();

jest.mock("../../lib/api", () => ({
  routesApi: {
    getWithDetails: (...args: any[]) => mockGetWithDetails(...args),
  },
}));

import FallHoldPickerScreen from "../../screens/FallHoldPickerScreen";
import {
  setPendingFallHoldCallback,
  hasPendingFallHoldCallback,
  clearPendingFallHoldCallback,
} from "../../lib/fall-hold-picker-bus";

const routeWithHolds = {
  route: {
    id: "r1",
    holds: {
      hand_holds: [
        { detected_hold_id: "h1", labelX: 0, labelY: 0, order: 1 },
        { detected_hold_id: "h2", labelX: 0, labelY: 0, order: 2 },
      ],
      foot_holds: [{ detected_hold_id: "f1", labelX: 0, labelY: 0 }],
    },
    photo: { id: "p1", image_url: "https://example.com/wall.jpg" },
  } as any,
  detectedHolds: [{ id: "h1" }, { id: "h2" }, { id: "f1" }] as any,
};

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

function makeNav() {
  return {
    goBack: jest.fn(),
    setOptions: jest.fn(),
  };
}

function renderScreen(nav: any, currentFallHoldId: string | null = null) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <FallHoldPickerScreen
        route={
          {
            params: { routeId: "r1", currentFallHoldId },
            key: "FallHoldPicker-test",
            name: "FallHoldPicker",
          } as any
        }
        navigation={nav}
      />,
    );
  });
  return renderer;
}

function findButtonByLabel(
  renderer: ReactTestRenderer,
  label: string,
): any | undefined {
  return renderer.root
    .findAllByType(TouchableOpacity)
    .find((b) => b.findAllByType(Text).some((t) => t.props.children === label));
}

describe("FallHoldPickerScreen", () => {
  beforeEach(() => {
    (global as any).__fsibProps = null;
    mockGetWithDetails.mockReset();
    clearPendingFallHoldCallback();
  });

  it("hand hold tap selects the corresponding detected hold", async () => {
    mockGetWithDetails.mockResolvedValue(routeWithHolds);
    const nav = makeNav();
    const renderer = renderScreen(nav);
    await flush();

    const fsibProps = (global as any).__fsibProps;
    expect(fsibProps).toBeTruthy();

    act(() => {
      fsibProps.onHandHoldPress(1);
    });

    const updated = (global as any).__fsibProps;
    expect(updated.selectedHoldId).toBe("h2");
  });

  it("foot hold tap selects the corresponding detected hold", async () => {
    mockGetWithDetails.mockResolvedValue(routeWithHolds);
    const nav = makeNav();
    const renderer = renderScreen(nav);
    await flush();

    act(() => {
      (global as any).__fsibProps.onFootHoldPress(0);
    });

    expect((global as any).__fsibProps.selectedHoldId).toBe("f1");
  });

  it("confirm resolves bus callback with selected id and navigates back", async () => {
    mockGetWithDetails.mockResolvedValue(routeWithHolds);
    const cb = jest.fn();
    setPendingFallHoldCallback(cb);

    const nav = makeNav();
    const renderer = renderScreen(nav);
    await flush();

    act(() => {
      (global as any).__fsibProps.onHandHoldPress(0);
    });

    const confirm = findButtonByLabel(renderer, "log.fallHoldConfirm");
    act(() => {
      confirm!.props.onPress();
    });

    expect(cb).toHaveBeenCalledWith("h1");
    expect(nav.goBack).toHaveBeenCalled();
    expect(hasPendingFallHoldCallback()).toBe(false);
  });

  it("skip resolves bus with null and navigates back", async () => {
    mockGetWithDetails.mockResolvedValue(routeWithHolds);
    const cb = jest.fn();
    setPendingFallHoldCallback(cb);

    const nav = makeNav();
    const renderer = renderScreen(nav, "h1");
    await flush();

    const skip = findButtonByLabel(renderer, "log.fallHoldSkip");
    act(() => {
      skip!.props.onPress();
    });

    expect(cb).toHaveBeenCalledWith(null);
    expect(nav.goBack).toHaveBeenCalled();
  });

  it("close without confirm does not resolve bus", async () => {
    mockGetWithDetails.mockResolvedValue(routeWithHolds);
    const cb = jest.fn();
    setPendingFallHoldCallback(cb);

    const nav = makeNav();
    renderScreen(nav);
    await flush();

    act(() => {
      (global as any).__fsibProps.onClose();
    });

    expect(cb).not.toHaveBeenCalled();
    expect(nav.goBack).toHaveBeenCalled();
  });

  it("confirm button is disabled when no selection", async () => {
    mockGetWithDetails.mockResolvedValue(routeWithHolds);
    const nav = makeNav();
    const renderer = renderScreen(nav);
    await flush();

    const confirm = findButtonByLabel(renderer, "log.fallHoldConfirm");
    expect(confirm!.props.disabled).toBe(true);
  });

  it("confirm button is enabled with pre-existing selection via params", async () => {
    mockGetWithDetails.mockResolvedValue(routeWithHolds);
    const nav = makeNav();
    const renderer = renderScreen(nav, "h1");
    await flush();

    const confirm = findButtonByLabel(renderer, "log.fallHoldConfirm");
    expect(confirm!.props.disabled).toBe(false);
  });
});
