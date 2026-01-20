import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { parseResponse } from 'hono/client';
import { Check, ChevronDown, CircleCheck, Mail, User } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import Stepper, { Step } from '@/components/ui/stepper';
import { cn } from '@/utils';
import type { User as UserType } from '@/utils/authentication';
import { authClient } from '@/utils/authentication';
import { api } from '@/utils/hc';

export const Route = createFileRoute('/auth/welcome')({
  component: RouteComponent,
});

function RouteComponent() {
  const { data, error, isPending } = authClient.useSession();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (isPending) {
      return;
    }
    if (!(data?.session && data?.user)) {
      navigate({ replace: true, to: '/auth/login' });
    }
  }, [data, isPending, navigate]);

  if (error) {
    return (
      <main className="grow items-center justify-center">
        <p className="text-red-500">
          {t('error.generic', { message: error.message })}
        </p>
      </main>
    );
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!data?.user) {
    return null;
  }

  return <WelcomeStepper user={data.user} />;
}

const InfoLine = (props: {
  icon: ReactNode;
  title: string;
  content: string;
}) => (
  <div className="flex w-full items-center gap-3">
    {props.icon}
    <div className="min-w-0 flex-1">
      <p className="font-medium text-foreground text-sm">{props.title}</p>
      <p className="truncate text-muted-foreground text-sm">{props.content}</p>
    </div>
  </div>
);

const NICKNAME_MIN_LENGTH = 3;
const NICKNAME_MAX_LENGTH = 32;
const nicknamePattern = /^[\p{L}\p{N} _'-]+$/u;
const normalizeNickname = (value?: string | null) =>
  (value ?? '').trim().replace(/\s+/g, ' ');

const WelcomeStepper = ({ user }: { user: UserType }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(user.nickname ?? '');
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(
    user.cohortId ?? null
  );

  const normalizedNickname = normalizeNickname(nicknameInput);
  const nicknameValid =
    normalizedNickname.length >= NICKNAME_MIN_LENGTH &&
    normalizedNickname.length <= NICKNAME_MAX_LENGTH &&
    nicknamePattern.test(normalizedNickname);

  const handleNicknameSave = async () => {
    setNicknameError(null);
    if (!nicknameValid) {
      setNicknameError(t('welcome.nicknameValidation'));
      return false;
    }
    try {
      setIsSubmitting(true);
      await authClient.updateUser({ nickname: normalizedNickname });
      toast.success(t('welcome.nicknameSaved'));
      return true;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : t('welcome.nicknameError');
      setNicknameError(errorMsg);
      toast.error(t('welcome.nicknameSaveFailed'));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCohortSave = async (cohortId: string) => {
    try {
      setIsSubmitting(true);
      setSelectedCohortId(cohortId);
      await authClient.updateUser({ cohortId });
      toast.success(t('welcome.cohortSaved'));
      return true;
    } catch {
      toast.error(t('welcome.cohortSaveFailed'));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStepChange = async (newStep: number) => {
    // Save nickname when leaving step 2 if there's a valid nickname
    if (currentStep === 2 && newStep > 2 && normalizedNickname) {
      const saved = await handleNicknameSave();
      if (!saved) {
        return; // Don't proceed if save failed
      }
    }
    setCurrentStep(newStep);
  };

  const handleFinalStepCompleted = async () => {
    setIsSubmitting(true);
    try {
      await navigate({ replace: true, to: '/' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getNextButtonText = () => {
    if (currentStep === 2) {
      return normalizedNickname ? t('common.next') : t('common.skip');
    }
    return t('common.next');
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Stepper
        backButtonText={t('common.back')}
        nextButtonLoading={isSubmitting}
        nextButtonText={getNextButtonText()}
        onFinalStepCompleted={handleFinalStepCompleted}
        onStepChange={handleStepChange}
      >
        <Step>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <CircleCheck className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="font-bold text-2xl">{t('welcome.title')}</h2>
                <p className="text-muted-foreground">{t('welcome.subtitle')}</p>
              </div>
            </div>
            <Card className="mb-1 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">
                  {t('account.details')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoLine
                  content={user.email}
                  icon={<Mail className="h-4 w-4 text-muted-foreground" />}
                  title={t('account.email')}
                />
                <InfoLine
                  content={user.name ?? t('unknown')}
                  icon={<User className="h-4 w-4 text-muted-foreground" />}
                  title={t('account.name')}
                />
              </CardContent>
            </Card>
          </div>
        </Step>

        <Step>
          <div className="space-y-4">
            <h2 className="font-bold text-2xl">{t('account.nickname')}</h2>
            <p className="text-muted-foreground text-sm">
              {t('welcome.nicknameDescription')}
            </p>
            <div className="space-y-2">
              <Label htmlFor="nickname">{t('account.nickname')}</Label>
              <Input
                autoComplete="off"
                id="nickname"
                maxLength={NICKNAME_MAX_LENGTH}
                onChange={(event) => {
                  setNicknameInput(event.target.value);
                  setNicknameError(null);
                }}
                placeholder={t('welcome.nicknamePlaceholder')}
                value={nicknameInput}
              />
              <p className="text-muted-foreground text-xs">
                {t('welcome.nicknameHelper', {
                  max: NICKNAME_MAX_LENGTH,
                  min: NICKNAME_MIN_LENGTH,
                })}
              </p>
              {nicknameError && (
                <p className="text-destructive text-xs">{nicknameError}</p>
              )}
            </div>
          </div>
        </Step>

        <Step>
          <div className="space-y-4">
            <h2 className="font-bold text-2xl">{t('cohort.select')}</h2>
            <p className="text-muted-foreground text-sm">
              {t('welcome.cohortDescription')}
            </p>
            <CohortSelectorStep
              onCohortSelect={handleCohortSave}
              selectedCohortId={selectedCohortId}
            />
          </div>
        </Step>

        <Step>
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
              <Check className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="font-bold text-2xl">{t('welcome.complete')}</h2>
            <p className="text-muted-foreground">
              {t('welcome.completeDescription')}
            </p>
          </div>
        </Step>
      </Stepper>
    </div>
  );
};

const CohortSelectorStep = (props: {
  selectedCohortId: string | null;
  onCohortSelect: (cohortId: string) => Promise<boolean>;
}) => {
  const { t } = useTranslation();
  const [updating, setIsUpdating] = useState(false);
  const [open, setOpen] = useState(false);

  const cohortQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(api.cohort.index.$get());
      if (!res.success) {
        throw new Error(t('cohort.fetchFailed'));
      }
      return res.data;
    },
    queryKey: ['cohorts'],
  });

  const updateCohort = async (cohortId: string) => {
    setIsUpdating(true);
    setOpen(false);
    const success = await props.onCohortSelect(cohortId);
    setIsUpdating(false);
    return success;
  };

  if (cohortQuery.isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  if (cohortQuery.error || !cohortQuery.data) {
    return (
      <div className="text-red-500">
        {t('cohort.errorLoading', { message: `${cohortQuery.error ?? ''}` })}
      </div>
    );
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-expanded={open}
            className="w-full justify-between"
            disabled={updating}
            role="combobox"
            variant="outline"
          >
            {props.selectedCohortId
              ? cohortQuery.data.find(
                  (cohort) => cohort.id === props.selectedCohortId
                )?.name
              : t('cohort.selectPlaceholder')}
            <ChevronDown className="opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="p-0">
        <Command>
          <CommandInput
            className="h-9"
            disabled={updating}
            placeholder={t('search')}
          />
          <CommandList>
            <CommandEmpty>{t('cohort.noneFound')}</CommandEmpty>
            <CommandGroup>
              {cohortQuery.data.map((cohort) => (
                <CommandItem
                  key={cohort.id}
                  onSelect={() => updateCohort(cohort.id)}
                  value={cohort.name}
                >
                  {cohort.name}
                  <Check
                    className={cn(
                      'ml-auto',
                      props.selectedCohortId === cohort.id
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
