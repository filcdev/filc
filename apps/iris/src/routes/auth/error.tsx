import { Button } from '@filcdev/ui/components/button';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Navbar } from '@/components/navbar';

const errorSearchSchema = z.object({
  error: z.string().optional(),
});

export const Route = createFileRoute('/auth/error')({
  component: RouteComponent,
  validateSearch: errorSearchSchema,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { error } = Route.useSearch();

  return (
    <>
      <Navbar showLinks={false} showLogo={true} />
      <main className="flex grow flex-col items-center justify-center gap-2">
        <span className="flex items-center gap-2 text-2xl font-bold">
          <CircleAlert className="text-destructive" />
          {t('auth.error.title')}
        </span>
        {error ? (
          <p className="text-muted-foreground text-center">
            {t(`auth.error.${error}`, {
              defaultValue: t('auth.error.genericMessage'),
            })}
          </p>
        ) : (
          <p className="text-center">{t('auth.error.genericMessage')}</p>
        )}
        <Button variant="secondary">
          <Link to="/">{t('auth.error.returnToHome')}</Link>
        </Button>
      </main>
      <footer className="text-muted-foreground p-1 text-center font-mono text-sm">
        Error code: {error ?? 'none'}
      </footer>
    </>
  );
}
