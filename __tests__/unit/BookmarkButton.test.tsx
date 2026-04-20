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
    textSecondary: "#555",
  }),
}));

jest.mock("../../lib/api", () => ({
  bookmarksApi: {
    isBookmarked: jest.fn(),
    toggle: jest.fn(),
  },
  cacheEvents: {
    subscribe: () => () => {},
  },
}));

let mockQueryResult: { data: any; loading: boolean } = {
  data: false,
  loading: false,
};

jest.mock("../../hooks/useApiQuery", () => ({
  useApiQuery: () => mockQueryResult,
}));

import BookmarkButton from "../../components/BookmarkButton";
import { bookmarksApi } from "../../lib/api";

function render(
  userId: string | undefined,
  onLoginRequired = () => {},
): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <BookmarkButton
        routeId="r1"
        userId={userId}
        onLoginRequired={onLoginRequired}
      />,
    );
  });
  return renderer;
}

function findIconName(renderer: ReactTestRenderer): string | undefined {
  const ionicons = renderer.root.findAll(
    (el) => el.type === ("Ionicons" as any),
  );
  return ionicons[0]?.props.name;
}

describe("BookmarkButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryResult = { data: false, loading: false };
  });

  it("renders bookmark-outline when not bookmarked", () => {
    mockQueryResult = { data: false, loading: false };
    const renderer = render("u1");
    expect(findIconName(renderer)).toBe("bookmark-outline");
  });

  it("renders filled bookmark when bookmarked", () => {
    mockQueryResult = { data: true, loading: false };
    const renderer = render("u1");
    expect(findIconName(renderer)).toBe("bookmark");
  });

  it("calls bookmarksApi.toggle on press when logged in", async () => {
    (bookmarksApi.toggle as jest.Mock).mockResolvedValue(true);
    const renderer = render("u1");
    const button = renderer.root.findByType(TouchableOpacity);

    await act(async () => {
      button.props.onPress();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(bookmarksApi.toggle).toHaveBeenCalledWith("u1", "r1");
  });

  it("calls onLoginRequired when no userId", () => {
    const onLoginRequired = jest.fn();
    const renderer = render(undefined, onLoginRequired);
    const button = renderer.root.findByType(TouchableOpacity);

    act(() => {
      button.props.onPress();
    });

    expect(onLoginRequired).toHaveBeenCalled();
    expect(bookmarksApi.toggle).not.toHaveBeenCalled();
  });

  it("prevents concurrent toggle presses", async () => {
    let resolveToggle!: () => void;
    (bookmarksApi.toggle as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((res) => {
          resolveToggle = () => res();
        }),
    );

    const renderer = render("u1");
    const button = renderer.root.findByType(TouchableOpacity);

    act(() => {
      button.props.onPress();
    });
    act(() => {
      button.props.onPress();
    });

    expect(bookmarksApi.toggle).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveToggle();
      await new Promise((r) => setTimeout(r, 0));
    });
  });
});
