import { Button } from '@filcdev/ui/components/button';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Navbar } from '@/components/navbar';
import { redirectSearchSchema, resolveReturnTo } from '@/utils/auth-redirect';

const errorSearchSchema = z.object({
  ...redirectSearchSchema.shape,
  error: z.string().optional(),
});

export const Route = createFileRoute('/auth/error')({
  component: RouteComponent,
  validateSearch: errorSearchSchema,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { error, redirect } = Route.useSearch();
  // A failed sign-in leaves no session, so returning to a protected page would
  // only bounce back here: the retry re-enters the sign-in with the same
  // destination instead.
  const returnTo = resolveReturnTo(redirect);

  return (
    <>
      <Navbar showLinks={false} showLogo={true} />
      <main className="flex grow flex-col items-center justify-center gap-2">
        <span className="flex items-center gap-2 font-bold text-2xl">
          <CircleAlert className="text-destructive" />
          {t('auth.error.title')}
        </span>
        {error ? (
          <p className="text-center text-muted-foreground">
            {t(`auth.error.${error}`, {
              defaultValue: t('auth.error.genericMessage'),
            })}
          </p>
        ) : (
          <p className="text-center">{t('auth.error.genericMessage')}</p>
        )}
        {returnTo === '/' ? (
          <Button variant="secondary">
            <Link to="/">{t('auth.error.returnToHome')}</Link>
          </Button>
        ) : (
          <Button variant="secondary">
            <Link search={{ redirect: returnTo }} to="/auth/login">
              {t('auth.error.retrySignIn')}
            </Link>
          </Button>
        )}
      </main>
      <footer className="p-1 text-center font-mono text-muted-foreground text-sm">
        Error code: {error ?? 'none'}
      </footer>
    </>
  );
}
