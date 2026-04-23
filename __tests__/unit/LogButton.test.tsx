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
    success: "#0f0",
    danger: "#f00",
    star: "#ff0",
    border: "#ccc",
    borderLight: "#eee",
    cardBackground: "#fff",
    textPrimary: "#111",
    textSecondary: "#555",
    primaryLight: "#eef",
  }),
}));

let mockCacheCallback: (() => void) | null = null;
const mockUnsubscribe = jest.fn();

jest.mock("../../lib/api", () => ({
  logsApi: {
    getByUserAndRoute: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  cacheEvents: {
    subscribe: (_key: string, cb: () => void) => {
      mockCacheCallback = cb;
      return mockUnsubscribe;
    },
  },
}));

jest.mock("../../components/BottomSheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockBottomSheet({
    visible,
    children,
    footer,
  }: {
    visible: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) {
    return (
      <View testID={visible ? "bottom-sheet-open" : "bottom-sheet-closed"}>
        {children}
        {footer}
      </View>
    );
  };
});

let mockQueryResult: { data: any; loading: boolean } = {
  data: null,
  loading: false,
};

jest.mock("../../hooks/useApiQuery", () => ({
  useApiQuery: () => mockQueryResult,
}));

import LogButton from "../../components/LogButton";
import { logsApi } from "../../lib/api";

const flushPromises = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

function makeLog(overrides: Partial<any> = {}) {
  return {
    id: "log-1",
    user_id: "user-1",
    route_id: "route-1",
    status: "sent",
    quality_rating: null,
    difficulty_rating: null,
    fall_hold_id: null,
    logged_at: "2026-04-20T00:00:00Z",
    created_at: "2026-04-20T00:00:00Z",
    ...overrides,
  };
}

function renderLogButton(onPickFallHold?: any): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <LogButton
        routeId="route-1"
        userId="user-1"
        onLoginRequired={() => {}}
        onPickFallHold={onPickFallHold}
      />,
    );
  });
  return renderer;
}

function findByLabel(renderer: ReactTestRenderer, label: string) {
  return renderer.root.findAllByType(TouchableOpacity).filter((el) => {
    return (el.props.accessibilityLabel ?? "") === label;
  });
}

function pressOpenButton(renderer: ReactTestRenderer) {
  const buttons = renderer.root.findAllByType(TouchableOpacity);
  act(() => {
    buttons[0].props.onPress();
  });
}

function findStatusToggle(
  renderer: ReactTestRenderer,
  status: "sent" | "attempted",
) {
  return findByLabel(renderer, `log.status.${status}`)[0];
}

describe("LogButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheCallback = null;
    mockQueryResult = { data: null, loading: false };
  });

  it("renders 'log.log' when no existing log", () => {
    const renderer = renderLogButton();
    const textNodes = renderer.root.findAllByType(Text);
    const labels = textNodes.map((n) => {
      const c = n.props.children;
      return Array.isArray(c) ? c.join("") : c;
    });
    expect(labels).toContain("log.log");
  });

  it("renders 'log.edit' when log exists", () => {
    mockQueryResult = { data: makeLog({ status: "sent" }), loading: false };
    const renderer = renderLogButton();
    const textNodes = renderer.root.findAllByType(Text);
    const labels = textNodes.map((n) => {
      const c = n.props.children;
      return Array.isArray(c) ? c.join("") : c;
    });
    expect(labels).toContain("log.edit");
  });

  it("opens modal on press", () => {
    const renderer = renderLogButton();
    expect(
      renderer.root.findAllByProps({ testID: "bottom-sheet-closed" }).length,
    ).toBeGreaterThan(0);

    pressOpenButton(renderer);

    expect(
      renderer.root.findAllByProps({ testID: "bottom-sheet-open" }).length,
    ).toBeGreaterThan(0);
  });

  it("shows difficulty section when status=sent (default)", () => {
    const renderer = renderLogButton();
    pressOpenButton(renderer);

    const textNodes = renderer.root.findAllByType(Text);
    const labels = textNodes.map((n) => n.props.children);
    expect(labels).toContain("log.difficultyForGrade");
    expect(labels).not.toContain("log.fallHoldLabel");
  });

  it("switches to fall hold section when toggling to attempted", () => {
    const renderer = renderLogButton();
    pressOpenButton(renderer);

    const attemptedToggle = findStatusToggle(renderer, "attempted");
    act(() => {
      attemptedToggle.props.onPress();
    });

    const textNodes = renderer.root.findAllByType(Text);
    const labels = textNodes.map((n) => n.props.children);
    expect(labels).toContain("log.fallHoldLabel");
    expect(labels).not.toContain("log.difficultyForGrade");
  });

  it("saves a sent log via logsApi.upsert", async () => {
    (logsApi.upsert as jest.Mock).mockResolvedValue(makeLog());
    const renderer = renderLogButton();
    pressOpenButton(renderer);

    // Find the save button (first TouchableOpacity inside footer, with text 'log.log')
    const buttons = renderer.root.findAllByType(TouchableOpacity);
    const saveButton = buttons.find((b) => {
      const texts = b.findAllByType(Text);
      return texts.some((t) => t.props.children === "log.log");
    });
    // Filter to the footer save button (inside bottom-sheet-open)
    const sheetOpen = renderer.root.findByProps({
      testID: "bottom-sheet-open",
    });
    const footerButtons = sheetOpen.findAllByType(TouchableOpacity);
    const footerSave = footerButtons.find((b) =>
      b.findAllByType(Text).some((t) => t.props.children === "log.log"),
    );

    await act(async () => {
      footerSave!.props.onPress();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(logsApi.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        route_id: "route-1",
        status: "sent",
      }),
    );
  });

  it("saves an attempted log with null difficulty", async () => {
    (logsApi.upsert as jest.Mock).mockResolvedValue(
      makeLog({ status: "attempted" }),
    );
    const renderer = renderLogButton();
    pressOpenButton(renderer);

    const attemptedToggle = findStatusToggle(renderer, "attempted");
    act(() => {
      attemptedToggle.props.onPress();
    });

    const sheetOpen = renderer.root.findByProps({
      testID: "bottom-sheet-open",
    });
    const footerButtons = sheetOpen.findAllByType(TouchableOpacity);
    const footerSave = footerButtons.find((b) =>
      b.findAllByType(Text).some((t) => t.props.children === "log.log"),
    );

    await act(async () => {
      footerSave!.props.onPress();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(logsApi.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "attempted",
        difficulty_rating: null,
      }),
    );
  });

  it("calls onPickFallHold when picker button pressed", () => {
    const onPickFallHold = jest.fn();
    const renderer = renderLogButton(onPickFallHold);
    pressOpenButton(renderer);

    const attemptedToggle = findStatusToggle(renderer, "attempted");
    act(() => {
      attemptedToggle.props.onPress();
    });

    const sheetOpen = renderer.root.findByProps({
      testID: "bottom-sheet-open",
    });
    const pickButton = sheetOpen
      .findAllByType(TouchableOpacity)
      .find((b) =>
        b
          .findAllByType(Text)
          .some((t) => t.props.children === "log.fallHoldPick"),
      );

    act(() => {
      pickButton!.props.onPress();
    });

    expect(onPickFallHold).toHaveBeenCalledWith(null, expect.any(Function));
  });

  it("delete removes the log via logsApi.delete", async () => {
    mockQueryResult = { data: makeLog(), loading: false };
    (logsApi.delete as jest.Mock).mockResolvedValue(undefined);
    const renderer = renderLogButton();
    pressOpenButton(renderer);

    const sheetOpen = renderer.root.findByProps({
      testID: "bottom-sheet-open",
    });
    const removeButton = sheetOpen
      .findAllByType(TouchableOpacity)
      .find((b) =>
        b.findAllByType(Text).some((t) => t.props.children === "log.remove"),
      );

    await act(async () => {
      removeButton!.props.onPress();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(logsApi.delete).toHaveBeenCalledWith("user-1", "route-1");
  });

  it("calls onLoginRequired when userId absent", () => {
    const onLoginRequired = jest.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <LogButton
          routeId="route-1"
          userId={undefined}
          onLoginRequired={onLoginRequired}
        />,
      );
    });

    pressOpenButton(renderer);
    expect(onLoginRequired).toHaveBeenCalled();
  });
});
