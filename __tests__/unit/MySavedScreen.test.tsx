import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockUseAuth = jest.fn();
jest.mock("../../lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockBookmarksListProps: { current: any } = { current: null };
jest.mock("../../components/UserBookmarksList", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockUserBookmarksList(props: any) {
    mockBookmarksListProps.current = props;
    return React.createElement(View, { testID: "user-bookmarks-list" });
  };
});

jest.mock("../../components/SafeScreen", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockSafeScreen({ children }: any) {
    return React.createElement(View, null, children);
  };
});

import MySavedScreen from "../../screens/MySavedScreen";

describe("MySavedScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    mockBookmarksListProps.current = null;
  });

  it("renders empty SafeScreen when no user", () => {
    mockUseAuth.mockReturnValue({ user: null });
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<MySavedScreen />);
    });
    expect(
      renderer.root.findAllByProps({ testID: "user-bookmarks-list" }).length,
    ).toBe(0);
  });

  it("renders UserBookmarksList with userId when logged in", () => {
    act(() => {
      create(<MySavedScreen />);
    });
    expect(mockBookmarksListProps.current.userId).toBe("u1");
    expect(mockBookmarksListProps.current.emptyMessage).toBe("bookmark.empty");
  });
});
