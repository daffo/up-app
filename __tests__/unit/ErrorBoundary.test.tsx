import React from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import ErrorBoundary from '../../components/ErrorBoundary';
import { Text, TouchableOpacity } from 'react-native';

// Suppress console.error/warn from ErrorBoundary and React error logging
const originalError = console.error;
const originalWarn = console.warn;
beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});
afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test error');
  return <Text>All good</Text>;
}

// React 19's test renderer needs onCaughtError to avoid unmounting on caught errors
const rendererOptions = {
  onCaughtError: () => {},
  onUncaughtError: () => {},
};

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>,
        rendererOptions as any,
      );
    });
    const texts = tree!.root.findAllByType(Text);
    expect(texts.some(t => t.props.children === 'All good')).toBe(true);
  });

  it('renders fallback UI when child throws', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
        rendererOptions as any,
      );
    });
    const texts = tree!.root.findAllByType(Text);
    const textContents = texts.map(t => t.props.children);
    expect(textContents).toContain('Something went wrong');
    expect(textContents).toContain('An unexpected error occurred. Please try again.');
    expect(textContents).toContain('Try Again');
  });

  it('recovers when retry is pressed and error is resolved', () => {
    let shouldThrow = true;

    function ConditionalThrower() {
      if (shouldThrow) throw new Error('Test error');
      return <Text>Recovered</Text>;
    }

    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <ErrorBoundary>
          <ConditionalThrower />
        </ErrorBoundary>,
        rendererOptions as any,
      );
    });

    // Should show fallback
    let texts = tree!.root.findAllByType(Text);
    expect(texts.some(t => t.props.children === 'Something went wrong')).toBe(true);

    // Fix the error, then press retry
    shouldThrow = false;
    const retryButton = tree!.root.findByType(TouchableOpacity);
    act(() => {
      retryButton.props.onPress();
    });

    // Should show recovered content
    texts = tree!.root.findAllByType(Text);
    expect(texts.some(t => t.props.children === 'Recovered')).toBe(true);
  });
});
