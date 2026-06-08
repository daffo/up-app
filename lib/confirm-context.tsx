import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmModal, { ConfirmOptions } from '../components/ConfirmModal';

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;
type NotifyFn = (options: ConfirmOptions) => Promise<void>;

interface ConfirmContextValue {
  confirm: ConfirmFn;
  notify: NotifyFn;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

interface DialogState extends ConfirmOptions {
  visible: boolean;
  hideCancel: boolean;
}

/**
 * Provides an imperative, awaitable confirmation dialog. Renders a single
 * themed ConfirmModal at app root and resolves the pending promise on the
 * user's choice. Use via the `useConfirm` hook.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [state, setState] = useState<DialogState>({
    visible: false,
    title: '',
    hideCancel: false,
  });
  const resolveRef = useRef<(value: boolean) => void>(() => {});

  const confirm = useCallback<ConfirmFn>((options) => {
    setState({ ...options, hideCancel: false, visible: true });
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const notify = useCallback<NotifyFn>((options) => {
    setState({ ...options, hideCancel: true, visible: true });
    return new Promise<void>((resolve) => {
      resolveRef.current = () => resolve();
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolveRef.current(result);
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  // Keep the value stable so consumers don't re-render needlessly.
  const value = useMemo(() => ({ confirm, notify }), [confirm, notify]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmModal
        visible={state.visible}
        title={state.title}
        message={state.message}
        confirmText={state.confirmText ?? (state.hideCancel ? t('common.ok') : t('common.confirm'))}
        cancelText={state.cancelText ?? t('common.cancel')}
        destructive={state.destructive}
        hideCancel={state.hideCancel}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

function useConfirmContext(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm/useNotify must be used within a ConfirmProvider');
  }
  return ctx;
}

/**
 * Returns an awaitable confirm function (themed, cross-platform):
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title, message, destructive: true })) { ... }
 */
export function useConfirm(): ConfirmFn {
  return useConfirmContext().confirm;
}

/**
 * Returns an awaitable single-button acknowledgement dialog. Resolves once the
 * user taps OK — use it to show a message and then act (e.g. navigate):
 *
 *   const notify = useNotify();
 *   await notify({ title, message });
 *   navigation.reset(...);
 */
export function useNotify(): NotifyFn {
  return useConfirmContext().notify;
}
