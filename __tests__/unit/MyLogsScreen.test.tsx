import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { TouchableOpacity } from "react-native";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("../../lib/theme-context", () => ({
  useThemeColors: () => ({
    primary: "#000",
    primaryLight: "#eef",
    borderLight: "#eee",
    cardBackground: "#fff",
    separator: "#eee",
    textSecondary: "#555",
  }),
}));

const mockUseAuth = jest.fn();
jest.mock("../../lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUserLogsListProps: { current: any } = { current: null };
jest.mock("../../components/UserLogsList", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockUserLogsList(props: any) {
    mockUserLogsListProps.current = props;
    return React.createElement(View, { testID: "user-logs-list" });
  };
});

jest.mock("../../components/SafeScreen", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockSafeScreen({ children }: any) {
    return React.createElement(View, null, children);
  };
});

import MyLogsScreen from "../../screens/MyLogsScreen";

function findPill(renderer: ReactTestRenderer, label: string) {
  return renderer.root
    .findAllByType(TouchableOpacity)
    .find((b) => b.props.accessibilityLabel === label);
}

describe("MyLogsScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    mockUserLogsListProps.current = null;
  });

  it("renders empty SafeScreen when no user", () => {
    mockUseAuth.mockReturnValue({ user: null });
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<MyLogsScreen />);
    });
    expect(
      renderer.root.findAllByProps({ testID: "user-logs-list" }).length,
    ).toBe(0);
  });

  it("defaults to empty statuses (both pills inactive, show all logs)", () => {
    act(() => {
      create(<MyLogsScreen />);
    });
    expect(mockUserLogsListProps.current.statuses).toEqual([]);
  });

  it("tapping Sent pill selects status=sent", () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<MyLogsScreen />);
    });
    const sent = findPill(renderer, "log.tab.sent");
    act(() => {
      sent!.props.onPress();
    });
    expect(mockUserLogsListProps.current.statuses).toEqual(["sent"]);
  });

  it("tapping both pills selects both statuses", () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<MyLogsScreen />);
    });
    act(() => {
      findPill(renderer, "log.tab.sent")!.props.onPress();
    });
    act(() => {
      findPill(renderer, "log.tab.attempted")!.props.onPress();
    });
    expect(new Set(mockUserLogsListProps.current.statuses)).toEqual(
      new Set(["sent", "attempted"]),
    );
  });

  it("tapping an active pill deselects it", () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<MyLogsScreen />);
    });
    act(() => {
      findPill(renderer, "log.tab.sent")!.props.onPress();
    });
    expect(mockUserLogsListProps.current.statuses).toEqual(["sent"]);
    act(() => {
      findPill(renderer, "log.tab.sent")!.props.onPress();
    });
    expect(mockUserLogsListProps.current.statuses).toEqual([]);
  });

  it("passes userId to UserLogsList", () => {
    act(() => {
      create(<MyLogsScreen />);
    });
    expect(mockUserLogsListProps.current.userId).toBe("u1");
  });
});
