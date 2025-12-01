import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { parseResponse } from 'hono/client';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FaCheck,
  FaChevronDown,
  FaCircleCheck,
  FaEnvelope,
  FaSpinner,
  FaUser,
} from 'react-icons/fa6';
import { toast } from 'sonner';
import { Button } from '~/frontend/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '~/frontend/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/frontend/components/ui/command';
import { Input } from '~/frontend/components/ui/input';
import { Label } from '~/frontend/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverPositioner,
  PopoverTrigger,
} from '~/frontend/components/ui/popover';
import { Skeleton } from '~/frontend/components/ui/skeleton';
import { cn } from '~/frontend/utils';
import type { User as UserType } from '~/frontend/utils/authentication';
import { authClient } from '~/frontend/utils/authentication';
import { apiClient } from '~/frontend/utils/hc';

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

  return (
    <div className="flex max-w-lg grow flex-col justify-center space-y-4 self-center">
      <div className="flex gap-4">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <FaCircleCheck className="h-10 w-10 text-primary" />
        </div>
        <div className="items-start space-y-2">
          <h1 className="font-bold text-4xl text-foreground">
            {t('welcome.title')}
          </h1>
          <p className="text-balance text-muted-foreground text-xl">
            {t('welcome.subtitle')}
          </p>
        </div>
      </div>
      {isPending && <AccountDetailsSkeleton />}
      {!isPending && data?.user && <AccountDetails user={data.user} />}
    </div>
  );
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

const CohortSelector = (props: { user: UserType }) => {
  const { t } = useTranslation();
  const [updating, setIsUpdating] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(
    props.user.cohortId ?? null
  );
  const [open, setOpen] = useState(false);

  const cohortQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(apiClient.cohort.index.$get());
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
    setSelectedCohortId(cohortId);
    await authClient.updateUser({ cohortId });
    setIsUpdating(false);
  };

  if (cohortQuery.isLoading) {
    return <Skeleton className="h-9 w-full" />;
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
            {selectedCohortId
              ? cohortQuery.data.find(
                  (cohort) => cohort.id === selectedCohortId
                )?.name
              : t('cohort.selectPlaceholder')}
            <FaChevronDown className="opacity-50" />
          </Button>
        }
      />
      <PopoverPositioner>
        <PopoverContent className="absolute w-[200px] p-0">
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
                    onSelect={updateCohort}
                    value={cohort.name}
                  >
                    {cohort.name}
                    <FaCheck
                      className={cn(
                        'ml-auto',
                        selectedCohortId === cohort.id
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
      </PopoverPositioner>
    </Popover>
  );
};

const NICKNAME_MIN_LENGTH = 3;
const NICKNAME_MAX_LENGTH = 32;
const nicknamePattern = /^[\p{L}\p{N} _'-]+$/u;
const normalizeNickname = (value?: string | null) =>
  (value ?? '').trim().replace(/\s+/g, ' ');

const AccountDetails = (props: { user: UserType }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = props;
  const [nicknameInput, setNicknameInput] = useState(user.nickname ?? '');
  const [savedNickname, setSavedNickname] = useState(user.nickname ?? '');
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [nicknameSuccess, setNicknameSuccess] = useState<string | null>(null);

  useEffect(() => {
    setNicknameInput(user.nickname ?? '');
    setSavedNickname(user.nickname ?? '');
  }, [user.nickname]);

  const normalizedInput = normalizeNickname(nicknameInput);
  const normalizedSaved = normalizeNickname(savedNickname);
  const nicknameDirty = normalizedInput !== normalizedSaved;
  const nicknameInputValid =
    normalizedInput.length >= NICKNAME_MIN_LENGTH &&
    normalizedInput.length <= NICKNAME_MAX_LENGTH &&
    nicknamePattern.test(normalizedInput);
  const canSaveNickname =
    nicknameDirty && nicknameInputValid && !isSavingNickname;
  const hasNickname = normalizedSaved.length >= NICKNAME_MIN_LENGTH;
  const canContinue = Boolean(user.cohortId && hasNickname);

  const handleNicknameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNicknameSuccess(null);
    if (!nicknameInputValid) {
      setNicknameError(t('welcome.nicknameValidation'));
      return;
    }
    try {
      setIsSavingNickname(true);
      await authClient.updateUser({ nickname: normalizedInput });
      setSavedNickname(normalizedInput);
      setNicknameError(null);
      setNicknameSuccess(t('welcome.nicknameSaved'));
    } catch (error) {
      toast.error(t('welcome.nicknameSaveFailed'));
      setNicknameError(
        error instanceof Error ? error.message : t('welcome.nicknameError')
      );
    } finally {
      setIsSavingNickname(false);
    }
  };

  return (
    <>
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex items-center justify-start space-y-1">
          <FaUser className="size-6 text-muted-foreground" />
          <CardTitle className="text-lg">{t('account.details')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-muted/50 p-3">
            <InfoLine
              content={user.email}
              icon={<FaEnvelope className="h-4 w-4 text-muted-foreground" />}
              title={t('account.email')}
            />
            <InfoLine
              content={user.name ?? t('unknown')}
              icon={<FaUser className="h-4 w-4 text-muted-foreground" />}
              title={t('account.name')}
            />
            <hr />
          </div>
          <form className="space-y-2" onSubmit={handleNicknameSubmit}>
            <div className="flex flex-col gap-1">
              <Label className="font-medium text-sm" htmlFor="nickname">
                {t('account.nickname')}
              </Label>
              <p className="text-muted-foreground text-xs">
                {t('welcome.nicknameDescription')}
              </p>
            </div>
            <Input
              autoComplete="off"
              id="nickname"
              maxLength={NICKNAME_MAX_LENGTH}
              onChange={(event) => {
                setNicknameInput(event.target.value);
                setNicknameError(null);
                setNicknameSuccess(null);
              }}
              placeholder={t('welcome.nicknamePlaceholder')}
              value={nicknameInput}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-xs">
                {t('welcome.nicknameHelper', {
                  max: NICKNAME_MAX_LENGTH,
                  min: NICKNAME_MIN_LENGTH,
                })}
              </p>
              <Button disabled={!canSaveNickname} size="sm" type="submit">
                {isSavingNickname ? (
                  <>
                    <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.loading')}
                  </>
                ) : (
                  t('welcome.nicknameSave')
                )}
              </Button>
            </div>
            {nicknameError && (
              <p className="text-destructive text-xs">{nicknameError}</p>
            )}
            {nicknameSuccess && (
              <p className="text-green-600 text-xs">{nicknameSuccess}</p>
            )}
          </form>
          <hr />
          <CohortSelector user={user} />
        </CardContent>
      </Card>
      <div className="space-y-2">
        <Button
          className="mx-auto"
          disabled={!canContinue}
          onClick={() => {
            if (!canContinue) {
              return;
            }
            navigate({ replace: true, to: '/' });
          }}
        >
          {t('continue')}
        </Button>
        {!hasNickname && (
          <p className="text-center text-muted-foreground text-sm">
            {t('welcome.nicknameRequired')}
          </p>
        )}
        {hasNickname && !user.cohortId && (
          <p className="text-center text-muted-foreground text-sm">
            {t('welcome.cohortRequired')}
          </p>
        )}
      </div>
    </>
  );
};

const AccountDetailsSkeleton = () => {
  const { t } = useTranslation();
  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="flex items-center justify-start space-y-1">
        <FaUser className="size-6 text-muted-foreground" />
        <CardTitle className="text-lg">{t('account.details')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-9 w-full" />
        <hr />
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
          <Skeleton className="h-4 w-4 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
