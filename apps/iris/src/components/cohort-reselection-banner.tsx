import { useNavigate, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { authClient } from '@/utils/authentication';

export function CohortReselectionBanner() {
  const { data, isPending } = authClient.useSession();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();

  const cohortId = data?.user?.cohortId;
  const isWelcomePage = router.state.location.pathname === '/auth/welcome';

  if (
    !(data?.session && data?.user) ||
    isPending ||
    cohortId ||
    isWelcomePage
  ) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[70]">
      <div className="flex items-center bg-warning text-warning-foreground shadow-md">
        <div className="min-w-0 flex-1 px-3 py-2 sm:px-4">
          <p className="font-semibold text-sm leading-5">
            {t('cohortReselectionBanner.title')}
          </p>
          <p className="mt-0.5 text-xs leading-5 opacity-95">
            {t('cohortReselectionBanner.description')}
          </p>
        </div>
        <Button
          className="shrink-0 text-warning-foreground hover:bg-warning-foreground/15"
          onClick={() => navigate({ to: '/auth/welcome' })}
          variant="ghost"
        >
          {t('cohortReselectionBanner.selectCohort')}
        </Button>
      </div>
    </div>
  );
}
