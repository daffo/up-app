// Lightweight module-level bus for passing the fall-hold picker result back to
// the caller without serializing a function through navigation params.
//
// Lifecycle:
//   1. Caller calls `setPendingFallHoldCallback(cb)` then navigates to the picker.
//   2. Picker invokes `resolvePendingFallHoldCallback(id)` on confirm or cancel.
//   3. Calling resolve clears the pending reference so it cannot fire twice.

type FallHoldCallback = (id: string | null) => void;

let pending: FallHoldCallback | null = null;

export function setPendingFallHoldCallback(cb: FallHoldCallback): void {
  pending = cb;
}

export function resolvePendingFallHoldCallback(id: string | null): void {
  const cb = pending;
  pending = null;
  if (cb) cb(id);
}

export function clearPendingFallHoldCallback(): void {
  pending = null;
}

export function hasPendingFallHoldCallback(): boolean {
  return pending !== null;
}
