export function confirmDestructiveAction(message: string) {
  if (typeof window === 'undefined') {
    return true;
  }
  // TODO: replace with custom modal dialog
  // biome-ignore lint/suspicious/noAlert: see above
  return window.confirm(message);
}
