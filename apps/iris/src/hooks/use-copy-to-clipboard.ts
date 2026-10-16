import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/**
 * Pre-Clipboard-API copy: the value has to be in a real selection for the
 * deprecated command to see it, and the element has to be in the document.
 */
function copyViaSelection(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

/** `navigator.clipboard` is absent over plain HTTP, hence the legacy fallback. */
async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard === undefined) {
    return copyViaSelection(text);
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copying a value the user can never see again (an API key secret) must not
 * fail silently, so this hook owns the toast as well as the clipboard write.
 */
export function useCopyToClipboard() {
  const { t } = useTranslation();

  return useCallback(
    async (text: string) => {
      if (await copyText(text)) {
        toast.success(t('apiKeys.copySuccess'));
      } else {
        toast.error(t('apiKeys.copyError'));
      }
    },
    [t]
  );
}
