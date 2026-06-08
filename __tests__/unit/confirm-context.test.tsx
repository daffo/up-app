import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../lib/theme-context', () => ({
  useThemeColors: () => ({
    cardBackground: '#fff',
    textPrimary: '#000',
    textSecondary: '#666',
    textOnPrimary: '#fff',
    cancelButton: '#eee',
    primary: '#007AFF',
    danger: '#d00',
  }),
}));

import { ConfirmProvider, useConfirm, useNotify } from '../../lib/confirm-context';

// Renders the provider and exposes confirm/notify to the test via a ref.
function setup() {
  const api: { confirm?: ReturnType<typeof useConfirm>; notify?: ReturnType<typeof useNotify> } = {};
  function Consumer() {
    api.confirm = useConfirm();
    api.notify = useNotify();
    return null;
  }
  let tree: ReactTestRenderer;
  act(() => {
    tree = create(
      <ConfirmProvider>
        <Consumer />
      </ConfirmProvider>,
    );
  });
  return { tree: tree!, api };
}

// Finds a button by its label: locate the Text node, then climb to the nearest
// TouchableOpacity ancestor (findAllByType is recursive, so matching on a parent
// would wrongly hit the outer overlay which contains every label).
function pressButton(tree: ReactTestRenderer, label: string) {
  const text = tree.root
    .findAllByType(Text)
    .find((t) => t.props.children === label);
  if (!text) throw new Error(`label "${label}" not found`);

  let node: typeof text | null = text.parent;
  while (node && node.type !== TouchableOpacity) {
    node = node.parent;
  }
  if (!node) throw new Error(`button for "${label}" not found`);
  act(() => node!.props.onPress());
}

describe('ConfirmProvider', () => {
  it('resolves true when the confirm button is pressed', async () => {
    const { tree, api } = setup();
    let result: boolean | undefined;
    act(() => {
      api.confirm!({ title: 'Delete?', confirmText: 'Delete', destructive: true }).then((r) => {
        result = r;
      });
    });
    pressButton(tree, 'Delete');
    await act(async () => {});
    expect(result).toBe(true);
  });

  it('resolves false when the cancel button is pressed', async () => {
    const { tree, api } = setup();
    let result: boolean | undefined;
    act(() => {
      api.confirm!({ title: 'Delete?', cancelText: 'Cancel' }).then((r) => {
        result = r;
      });
    });
    pressButton(tree, 'Cancel');
    await act(async () => {});
    expect(result).toBe(false);
  });

  it('notify resolves on OK and renders no cancel button', async () => {
    const { tree, api } = setup();
    let resolved = false;
    act(() => {
      api.notify!({ title: 'Success', message: 'done', confirmText: 'OK', cancelText: 'Cancel' }).then(() => {
        resolved = true;
      });
    });

    // single-button mode: cancel label must not be rendered
    const hasCancel = tree.root
      .findAllByType(Text)
      .some((t) => t.props.children === 'Cancel');
    expect(hasCancel).toBe(false);

    pressButton(tree, 'OK');
    await act(async () => {});
    expect(resolved).toBe(true);
  });
});
