import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { useUnsubscribe } from '@/hooks/notifications';

export const Route = createFileRoute('/_public/unsubscribe')({
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const unsubscribeMutation = useUnsubscribe();
  const [status, setStatus] = useState<'loading' | 'error' | 'done'>('loading');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    const u = params.get('userId');
    if (!(t && u)) {
      setStatus('error');
      setMessage('Invalid or expired unsubscribe link');
      return;
    }
    setToken(t);
    setUserId(u);
    setStatus('done');
  }, []);

  const handleUnsubscribe = () => {
    setStatus('loading');

    unsubscribeMutation.mutate(
      { token, userId },
      {
        onError: () => {
          setStatus('error');
          setMessage('Failed to update preferences');
        },
        onSuccess: () => {
          setStatus('done');
          setMessage('Preferences updated successfully');
        },
      }
    );
  };

  const titleMap: Record<string, string> = {
    done: 'Notification Preferences',
    error: 'Error',
    loading: 'Loading...',
  };

  return (
    <div className="bg-muted/50 flex min-h-screen items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl p-8 text-center shadow-2xl">
        <h1 className="text-2xl font-bold">{titleMap[status]}</h1>
        <p className="text-muted-foreground mt-4">
          {status === 'loading'
            ? 'Loading...'
            : message || 'Manage your notification preferences'}
        </p>
        {status === 'done' && token && userId && !message && (
          <button
            className="bg-destructive text-destructive-foreground mt-6 rounded-lg px-6 py-2 hover:opacity-90"
            onClick={handleUnsubscribe}
            type="button"
          >
            Unsubscribe from all notifications
          </button>
        )}
      </div>
    </div>
  );
}
