import { useCookies } from 'react-cookie';
import { useTranslation } from 'react-i18next';
import { FaCookieBite } from 'react-icons/fa6';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '~/frontend/components/ui/alert';
import { Button } from '~/frontend/components/ui/button';

export function CookiePopup() {
  const [cookies, setCookie] = useCookies(['filc.cookie-consent']);
  const { t } = useTranslation();

  const acceptCookies = () => {
    setCookie('filc.cookie-consent', 'accepted', {
      maxAge: 31_536_000,
    });
  };

  if (cookies['filc.cookie-consent'] === 'accepted') {
    return null;
  }

  return (
    <Alert
      className="-translate-x-1/2 fixed bottom-4 left-1/2 z-50 w-[90%] max-w-md md:w-full"
      variant="default"
    >
      <FaCookieBite />
      <AlertTitle>{t('cookiePopup.title')}</AlertTitle>
      <AlertDescription>
        {t('cookiePopup.description')}
        <Button onClick={acceptCookies}>{t('common.accept')}</Button>
      </AlertDescription>
    </Alert>
  );
}
