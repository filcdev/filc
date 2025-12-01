import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { FaCircleExclamation } from 'react-icons/fa6';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/ui/navbar';

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
        <span className="flex items-center gap-2 font-bold text-2xl">
          <FaCircleExclamation className="text-destructive" />
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
        <Button variant="secondary">
          <Link to="/">{t('auth.error.returnToHome')}</Link>
        </Button>
      </main>
      <footer className="p-1 text-center font-mono text-muted-foreground text-sm">
        Error code: {error ?? 'none'}
      </footer>
    </>
  );
}
