import { useEffect, useMemo } from 'react';
import { useCookies } from 'react-cookie';
import { useTranslation } from 'react-i18next';
import { toast, useSonner } from 'sonner';

export function CookiePopup() {
  const [cookies, setCookie] = useCookies(['filc.cookie-consent']);
  const { toasts } = useSonner();
  const { t } = useTranslation();

  const isAccepted = useMemo(
    () => cookies['filc.cookie-consent'] === 'accepted',
    [cookies]
  );

  const isToastActive = useMemo(
    () => toasts.some((ts) => ts.id === 'cookie-consent'),
    [toasts]
  );

  useEffect(() => {
    if (!(isAccepted || isToastActive)) {
      toast.info(t('cookiePopup.title'), {
        action: {
          label: t('common.accept'),
          onClick: () => {
            setCookie('filc.cookie-consent', 'accepted', {
              maxAge: 31_536_000,
            });
          },
        },
        description: t('cookiePopup.description'),
        id: 'cookie-consent',
      });
    }
  }, [isAccepted, t, setCookie, isToastActive]);

  useEffect(() => {
    if (isAccepted && isToastActive) {
      toast.dismiss('cookie-consent');
    }
  }, [isAccepted, isToastActive]);

  return null;
}
