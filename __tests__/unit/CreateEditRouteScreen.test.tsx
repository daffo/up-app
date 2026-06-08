import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Alert, TouchableOpacity, Text } from 'react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../lib/theme-context', () => ({
  useThemeColors: () => ({
    screenBackground: '#fff',
    cardBackground: '#fff',
    inputBackground: '#fff',
    border: '#ccc',
    textPrimary: '#000',
    textSecondary: '#666',
    textTertiary: '#999',
    textOnPrimary: '#fff',
    placeholderText: '#aaa',
    primary: '#007AFF',
    danger: '#d00',
    success: '#0a0',
  }),
}));

// useConfirm — capture the call args and control how it resolves per test.
let confirmResult = true;
const mockConfirm = jest.fn(() => Promise.resolve(confirmResult));
jest.mock('../../lib/confirm-context', () => ({
  useConfirm: () => mockConfirm,
}));

const mockDelete = jest.fn();
jest.mock('../../lib/api', () => ({
  routesApi: {
    delete: (...args: any[]) => mockDelete(...args),
    get: jest.fn(),
  },
  photosApi: { listActive: jest.fn() },
  detectedHoldsApi: { listByPhoto: jest.fn(() => Promise.resolve([])) },
}));

// useApiQuery is mocked to hand back edit-mode data synchronously.
const mockUseApiQuery = jest.fn();
jest.mock('../../hooks/useApiQuery', () => ({
  useApiQuery: (...args: any[]) => mockUseApiQuery(...args),
}));

jest.mock('../../lib/cache/image-cache', () => ({
  getImageDimensions: jest.fn(() => Promise.resolve({ width: 100, height: 100 })),
}));

jest.mock('../../lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

// Stub heavy / native-only children so the screen renders under the test renderer.
jest.mock('../../components/SafeScreen', () => {
  const { View } = require('react-native');
  return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/CachedImage', () => 'CachedImage');
jest.mock('../../components/FullScreenRouteEditor', () => 'FullScreenRouteEditor');
jest.mock('../../components/RouteOverlay', () => 'RouteOverlay');
jest.mock('../../components/DraftBanner', () => 'DraftBanner');
jest.mock('../../components/TrimmedTextInput', () => {
  const { TextInput } = require('react-native');
  return (props: any) => <TextInput {...props} />;
});
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return { GestureHandlerRootView: ({ children }: any) => <View>{children}</View> };
});
jest.mock('react-native-draggable-flatlist', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => <View />,
    ScaleDecorator: ({ children }: any) => <View>{children}</View>,
  };
});

import CreateEditRouteScreen from '../../screens/CreateEditRouteScreen';

const PHOTO = { id: 'photo-1', image_url: 'https://example.com/wall.jpg' } as any;
const OWNED_ROUTE = {
  id: 'route-1',
  user_id: 'user-1',
  title: 'My Route',
  description: '',
  grade: '6a',
  photo_id: 'photo-1',
  holds: { hand_holds: [], foot_holds: [] },
} as any;

const navigation = { reset: jest.fn(), goBack: jest.fn(), navigate: jest.fn() } as any;
const route = { key: 'k', name: 'CreateEditRoute' as const, params: { routeId: 'route-1' } } as any;

function renderEdit() {
  mockUseApiQuery.mockReturnValue({
    data: { photos: [PHOTO], existingRoute: OWNED_ROUTE },
    loading: false,
  });
  let tree: ReactTestRenderer;
  act(() => {
    tree = create(<CreateEditRouteScreen navigation={navigation} route={route} />);
  });
  return tree!;
}

function pressDelete(tree: ReactTestRenderer) {
  const text = tree.root.findAllByType(Text).find((t) => t.props.children === 'common.delete');
  if (!text) throw new Error('Delete button not found');
  let node: any = text.parent;
  while (node && node.type !== TouchableOpacity) node = node.parent;
  node.props.onPress();
}

describe('CreateEditRouteScreen delete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    confirmResult = true;
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockDelete.mockResolvedValue(undefined);
  });

  it('asks for a destructive confirmation before deleting', async () => {
    const tree = renderEdit();
    await act(async () => { pressDelete(tree); });

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmText: 'common.delete', destructive: true }),
    );
  });

  it('deletes the route and resets navigation when confirmed', async () => {
    confirmResult = true;
    const tree = renderEdit();
    await act(async () => { pressDelete(tree); });

    expect(mockDelete).toHaveBeenCalledWith('route-1');
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Home' }] });
  });

  it('does not delete when the confirmation is cancelled', async () => {
    confirmResult = false;
    const tree = renderEdit();
    await act(async () => { pressDelete(tree); });

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(navigation.reset).not.toHaveBeenCalled();
  });
});
