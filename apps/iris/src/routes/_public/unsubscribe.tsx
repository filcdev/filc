import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUnsubscribe } from '@/hooks/notifications';

export const Route = createFileRoute('/_public/unsubscribe')({
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { t } = useTranslation();
  const unsubscribeMutation = useUnsubscribe();
  const [status, setStatus] = useState<'loading' | 'error' | 'done'>('loading');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextToken = params.get('token');
    const nextUserId = params.get('userId');
    if (!(nextToken && nextUserId)) {
      setStatus('error');
      setMessage(t('unsubscribe.invalidToken'));
      return;
    }
    setToken(nextToken);
    setUserId(nextUserId);
    setStatus('done');
  }, [t]);

  const handleUnsubscribe = () => {
    setStatus('loading');

    unsubscribeMutation.mutate(
      { token, userId },
      {
        onError: () => {
          setStatus('error');
          setMessage(t('unsubscribe.error'));
        },
        onSuccess: () => {
          setStatus('done');
          setMessage(t('unsubscribe.success'));
        },
      }
    );
  };

  const titleMap: Record<string, string> = {
    done: t('unsubscribe.title'),
    error: t('unsubscribe.title'),
    loading: t('common.loading'),
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 text-center shadow-2xl">
        <h1 className="font-bold text-2xl">{titleMap[status]}</h1>
        <p className="mt-4 text-muted-foreground">
          {status === 'loading'
            ? t('common.loading')
            : message || t('unsubscribe.description')}
        </p>
        {status === 'done' && token && userId && !message && (
          <button
            className="mt-6 rounded-lg bg-destructive px-6 py-2 text-destructive-foreground hover:opacity-90"
            onClick={handleUnsubscribe}
            type="button"
          >
            {t('unsubscribe.action')}
          </button>
        )}
      </div>
    </div>
  );
}
