import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { TouchableOpacity, Text } from "react-native";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("../../lib/theme-context", () => ({
  useThemeColors: () => ({
    primary: "#000",
    cardBackground: "#fff",
    separator: "#eee",
    textSecondary: "#555",
  }),
}));

const mockUseAuth = jest.fn();
jest.mock("../../lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

// Capture the status prop passed to UserLogsList for tab verification
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

function findTabButton(renderer: ReactTestRenderer, label: string) {
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
    // No UserLogsList rendered
    expect(
      renderer.root.findAllByProps({ testID: "user-logs-list" }).length,
    ).toBe(0);
  });

  it("defaults to sent tab", () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<MyLogsScreen />);
    });
    expect(mockUserLogsListProps.current.status).toBe("sent");
  });

  it("switches to attempted tab on press", () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<MyLogsScreen />);
    });
    const attemptedTab = findTabButton(renderer, "log.tab.attempted");
    act(() => {
      attemptedTab!.props.onPress();
    });
    expect(mockUserLogsListProps.current.status).toBe("attempted");
  });

  it("passes userId to UserLogsList", () => {
    act(() => {
      create(<MyLogsScreen />);
    });
    expect(mockUserLogsListProps.current.userId).toBe("u1");
  });
});
