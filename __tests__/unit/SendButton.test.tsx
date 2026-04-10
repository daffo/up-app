import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { TouchableOpacity } from "react-native";

// ── Mocks (must be declared before any imports that trigger module loading) ──

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

// Capture the subscribe callback so tests can trigger cache-invalidation manually.
// Variable must be mock-prefixed to be accessible inside jest.mock() factories.
let mockCacheCallback: (() => void) | null = null;
const mockUnsubscribe = jest.fn();

jest.mock("../../lib/api", () => ({
  sendsApi: {
    getByUserAndRoute: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  cacheEvents: {
    subscribe: (_key: string, cb: () => void) => {
      mockCacheCallback = cb;
      return mockUnsubscribe;
    },
  },
}));

// Mock BottomSheet to always render its children regardless of `visible`, so
// we can inspect the form elements in the tree without fighting RN Modal.
// We expose the `visible` prop via testID so tests can assert open/closed state.
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

// Control useApiQuery from the outside so we can push new data mid-test.
// Variable must be mock-prefixed to be accessible inside jest.mock() factories.
let mockQueryResult: { data: any; loading: boolean } = {
  data: null,
  loading: false,
};

jest.mock("../../hooks/useApiQuery", () => ({
  useApiQuery: () => mockQueryResult,
}));

// ── Import component under test (after all mocks) ──
import SendButton from "../../components/SendButton";

// ── Helpers ──

const flushPromises = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

function makeSend(
  overrides: Partial<{
    quality_rating: number | null;
    difficulty_rating: number | null;
  }> = {},
) {
  return {
    id: "send-1",
    quality_rating: null,
    difficulty_rating: null,
    ...overrides,
  };
}

function makeSendButtonElement() {
  return (
    <SendButton routeId="route-1" userId="user-1" onLoginRequired={() => {}} />
  );
}

function renderSendButton(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(makeSendButtonElement());
  });
  return renderer;
}

/**
 * Force a re-render so the component picks up the new mockQueryResult value.
 * A new element instance must be passed to renderer.update() — reusing the same
 * element reference causes React to bail out and not re-render.
 */
function rerenderSendButton(renderer: ReactTestRenderer) {
  act(() => {
    renderer.update(makeSendButtonElement());
  });
}

/**
 * Find the star TouchableOpacity buttons rendered inside the bottom sheet.
 * Stars have accessibilityLabel "sends.rateStar" (the passthrough t() returns the key).
 */
function findStarButtons(renderer: ReactTestRenderer): any[] {
  return renderer.root.findAllByType(TouchableOpacity).filter((el) => {
    const label: string = el.props.accessibilityLabel ?? "";
    return label.startsWith("sends.rateStar");
  });
}

/**
 * Returns the filled star count: how many star buttons render the filled "star"
 * icon (as opposed to "star-outline"). We check the Ionicons name prop on the
 * immediate child of each star button.
 */
function countFilledStars(renderer: ReactTestRenderer): number {
  const starButtons = findStarButtons(renderer);
  // findAllByProps returns [] when nothing matches (unlike findByProps which throws).
  return starButtons.filter(
    (btn) => btn.findAllByProps({ name: "star" } as any).length > 0,
  ).length;
}

/**
 * Press the main SendButton (the one that opens the modal).
 * We identify it as the first TouchableOpacity that does NOT live inside the
 * bottom-sheet (i.e., comes before the mock sheet in tree order) — or simply
 * the first TouchableOpacity when the modal is closed.
 */
function pressOpenButton(renderer: ReactTestRenderer) {
  // The sheet's testID alternates; when closed the sheet testID is "bottom-sheet-closed".
  // The open button is the first TouchableOpacity in the tree.
  const buttons = renderer.root.findAllByType(TouchableOpacity);
  act(() => {
    buttons[0].props.onPress();
  });
}

// ── Tests ──

describe("SendButton — PERF-9: form state sync guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheCallback = null;
    // Reset to a neutral state between tests
    mockQueryResult = { data: null, loading: false };
  });

  it("does not reset form when send updates while modal is open", async () => {
    // Start with a send that has quality_rating 3, difficulty_rating 0
    mockQueryResult = {
      data: makeSend({ quality_rating: 3, difficulty_rating: 0 }),
      loading: false,
    };

    const renderer = renderSendButton();

    // Flush initial effects so the sync useEffect runs once (modal is closed → syncs)
    await flushPromises();

    // Verify initial sync: 3 stars should be filled
    expect(countFilledStars(renderer)).toBe(3);

    // Open the modal
    pressOpenButton(renderer);

    // Simulate a cache invalidation that delivers updated send data (quality_rating: 4)
    // while the modal is still open. We update the mock and force a re-render to
    // make the component read the new send value. The useEffect guard (!modalVisible)
    // must prevent the sync from clobbering the user's in-progress form state.
    await act(async () => {
      mockQueryResult = {
        data: makeSend({ quality_rating: 4, difficulty_rating: 1 }),
        loading: false,
      };
      rerenderSendButton(renderer);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Form state must remain at the values set BEFORE the update (3 stars, not 4)
    expect(countFilledStars(renderer)).toBe(3);
  });

  it("syncs form state when send updates while modal is closed", async () => {
    // Start with quality_rating 3
    mockQueryResult = {
      data: makeSend({ quality_rating: 3, difficulty_rating: 0 }),
      loading: false,
    };

    const renderer = renderSendButton();
    await flushPromises();

    // Modal is still closed — initial sync should have applied (3 stars)
    expect(countFilledStars(renderer)).toBe(3);

    // Simulate the send being updated (quality_rating: 4) without opening the modal.
    // Since useApiQuery is fully mocked, we update the result object and force a
    // re-render so the component reads the new value and the useEffect fires.
    mockQueryResult = {
      data: makeSend({ quality_rating: 4, difficulty_rating: 0 }),
      loading: false,
    };
    rerenderSendButton(renderer);
    await flushPromises();

    // Because the modal is closed, the useEffect should have synced → 4 stars
    expect(countFilledStars(renderer)).toBe(4);
  });
});
