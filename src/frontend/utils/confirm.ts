export function confirmDestructiveAction(message: string) {
  if (typeof window === 'undefined') {
    return true;
  }
  // eslint-disable-next-line no-alert
  // biome-ignore lint/suspicious/noAlert: shush
  return window.confirm(message);
}
