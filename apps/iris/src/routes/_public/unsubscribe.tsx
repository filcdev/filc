import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/_public/unsubscribe')({
  component: UnsubscribePage,
});

function UnsubscribePage() {
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

    fetch('/api/notifications/unsubscribe', {
      body: new URLSearchParams({ token, userId }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })
      .then(() => {
        setStatus('done');
        setMessage('Preferences updated successfully');
      })
      .catch(() => {
        setStatus('error');
        setMessage('Failed to update preferences');
      });
  };

  const titleMap: Record<string, string> = {
    done: 'Notification Preferences',
    error: 'Error',
    loading: 'Loading...',
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 text-center shadow-2xl">
        <h1 className="font-bold text-2xl">{titleMap[status]}</h1>
        <p className="mt-4 text-muted-foreground">
          {status === 'loading'
            ? 'Loading...'
            : message || 'Manage your notification preferences'}
        </p>
        {status === 'done' && token && userId && !message && (
          <button
            className="mt-6 rounded-lg bg-destructive px-6 py-2 text-destructive-foreground hover:opacity-90"
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
