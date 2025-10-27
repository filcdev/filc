import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { parseResponse } from 'hono/client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FaCheck,
  FaChevronDown,
  FaCircleCheck,
  FaEnvelope,
  FaMicrosoft,
  FaSpinner,
  FaUser,
} from 'react-icons/fa6';
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
import {
  Popover,
  PopoverContent,
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
  icon: React.ReactNode;
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
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className="w-full justify-between"
          disabled={updating}
          role="combobox"
          variant="outline"
        >
          {selectedCohortId
            ? cohortQuery.data.find((cohort) => cohort.id === selectedCohortId)
                ?.name
            : t('cohort.selectPlaceholder')}
          <FaChevronDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
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
                  value={cohort.id}
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
    </Popover>
  );
};

const AccountDetails = (props: { user: UserType }) => {
  const { t } = useTranslation();
  const { refetch } = authClient.useSession();
  const navigate = useNavigate();
  const { user } = props;

  useEffect(() => {
    const syncUserDetails = async () => {
      try {
        await parseResponse(apiClient.auth['sync-account'].$get());
      } catch {
        // Swallow errors to mirror previous fire-and-forget behaviour
      }
    };
    if (!user.name) {
      syncUserDetails().then(() => refetch());
    }
  }, [user.name, refetch]);

  return (
    <>
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex items-center justify-start space-y-1">
          <FaUser className="size-6 text-muted-foreground" />
          <CardTitle className="text-lg">{t('account.details')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MicrosoftLink />
          <hr />
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
          <hr />
          <CohortSelector user={user} />
        </CardContent>
      </Card>
      {user.cohortId && (
        <Button
          className="mx-auto"
          onClick={() => {
            navigate({ replace: true, to: '/' });
          }}
        >
          {t('continue')}
        </Button>
      )}
    </>
  );
};

const MicrosoftLink = () => {
  const { t } = useTranslation();
  const [isPending, setIsPending] = useState(true);
  const [isAlreadyLinked, setIsAlreadyLinked] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const { refetch } = authClient.useSession();

  const getIsLinked = useCallback(async () => {
    const res = await authClient.listAccounts();

    if (res.error) {
      setIsAlreadyLinked(false);
    } else {
      setIsAlreadyLinked(
        res.data.some((acc) => acc.providerId === 'microsoft')
      );
    }
    setIsPending(false);
  }, []);

  useEffect(() => {
    getIsLinked();
  }, [getIsLinked]);

  const handleUnlink = async () => {
    setIsUnlinking(true);
    try {
      await authClient.unlinkAccount({ providerId: 'microsoft' });
      await getIsLinked();
      refetch();
    } finally {
      setIsUnlinking(false);
    }
  };

  if (isPending) {
    return <Skeleton className="flex h-8 items-center justify-center" />;
  }

  if (isAlreadyLinked) {
    return (
      <div className="flex h-8 items-center justify-between text-primary text-sm">
        <div className="flex items-center gap-2">
          <FaCircleCheck className="size-4" />
          <span>{t('microsoft.linked')}</span>
        </div>
        <Button
          className="text-muted-foreground text-xs"
          disabled={isUnlinking}
          onClick={handleUnlink}
          size="sm"
          variant="ghost"
        >
          {isUnlinking ? (
            <FaSpinner className="size-4 animate-spin" />
          ) : (
            t('unlink')
          )}
        </Button>
      </div>
    );
  }

  return (
    <Button
      className="w-full justify-start"
      onClick={() => {
        authClient.linkSocial({
          callbackURL: '/auth/welcome',
          errorCallbackURL: '/auth/error?from=link-microsoft',
          provider: 'microsoft',
        });
      }}
      variant="outline"
    >
      <FaMicrosoft className="mr-2 size-5" />
      <span>{t('microsoft.linkAccount')}</span>
    </Button>
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
