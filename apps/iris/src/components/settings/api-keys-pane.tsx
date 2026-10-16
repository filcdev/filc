import { ApiKeysCard } from '@/components/api-keys/api-keys-card';

/**
 * The signed-in user's own API keys.
 *
 * The card owns its query and its dialogs, so the pane is just the card — but
 * it stays a pane so the dialog's nav has a uniform shape and this section can
 * grow without touching the dialog.
 */
export function ApiKeysPane() {
  return <ApiKeysCard />;
}
