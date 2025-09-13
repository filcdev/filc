import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Check,
  CheckCircle,
  ChevronsUpDown,
  Loader2,
  Mail,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { FaMicrosoft } from 'react-icons/fa6';
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

export const Route = createFileRoute('/auth/welcome')({
  component: RouteComponent,
});

function RouteComponent() {
  const { data, error, isPending } = authClient.useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (isPending) {
      return;
    }
    if (!(data?.session && data?.user)) {
      navigate({ to: '/auth/login', replace: true });
    }
  }, [data, isPending, navigate]);

  if (error) {
    return (
      <main className="grow items-center justify-center">
        <p className="text-red-500">Error: {error.message}</p>
      </main>
    );
  }

  return (
    <div className="flex max-w-lg grow flex-col justify-center space-y-4 self-center">
      <div className="flex gap-4">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle className="h-10 w-10 text-primary" />
        </div>
        <div className="items-start space-y-2">
          <h1 className="font-bold text-4xl text-foreground">Welcome!</h1>
          <p className="text-balance text-muted-foreground text-xl">
            Let us get to know you
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
}) => {
  return (
    <div className="flex w-full items-center gap-3">
      {props.icon}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground text-sm">{props.title}</p>
        <p className="truncate text-muted-foreground text-sm">
          {props.content}
        </p>
      </div>
    </div>
  );
};

const CohortSelector = (props: { user: UserType }) => {
  const [updating, setIsUpdating] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(
    props.user.cohortId ?? null
  );
  const [open, setOpen] = useState(false);

  const cohortQuery = useQuery({
    queryKey: ['cohorts'],
    queryFn: async () => {
      const res = await fetch('/api/cohort');
      return (await res.json()) as { id: string; name: string }[];
    },
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
        Error loading cohorts: {`${cohortQuery.error ?? 'Unknown Error'}`}
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
            : 'Select class...'}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput
            className="h-9"
            disabled={updating}
            placeholder="Search framework..."
          />
          <CommandList>
            <CommandEmpty>No framework found.</CommandEmpty>
            <CommandGroup>
              {cohortQuery.data.map((cohort) => (
                <CommandItem
                  key={cohort.id}
                  onSelect={updateCohort}
                  value={cohort.id}
                >
                  {cohort.name}
                  <Check
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
  const { refetch } = authClient.useSession();
  const { user } = props;

  useEffect(() => {
    const syncUserDetails = async () => {
      await fetch('/api/auth/sync-account');
    };
    if (!user.name) {
      syncUserDetails().then(() => refetch());
    }
  }, [user.name, refetch]);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="flex items-center justify-start space-y-1">
        <User className="size-6 text-muted-foreground" />
        <CardTitle className="text-lg">Account Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <MicrosoftLink />
        <hr />
        <div className="flex flex-col items-center gap-3 rounded-lg bg-muted/50 p-3">
          <InfoLine
            content={user.email}
            icon={<Mail className="h-4 w-4 text-muted-foreground" />}
            title="Email"
          />
          <InfoLine
            content={user.name ?? 'Unknown'}
            icon={<User className="h-4 w-4 text-muted-foreground" />}
            title="Name"
          />
          <hr />
        </div>
        <hr />
        <CohortSelector user={user} />
      </CardContent>
    </Card>
  );
};

const MicrosoftLink = () => {
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
          <CheckCircle className="size-4" />
          <span>Microsoft linked</span>
        </div>
        <Button
          className="text-muted-foreground text-xs"
          disabled={isUnlinking}
          onClick={handleUnlink}
          size="sm"
          variant="ghost"
        >
          {isUnlinking ? <Loader2 className="size-4 animate-spin" /> : 'Unlink'}
        </Button>
      </div>
    );
  }

  return (
    <Button
      className="w-full justify-start"
      onClick={() => {
        authClient.linkSocial({
          provider: 'microsoft',
          callbackURL: '/auth/welcome',
          errorCallbackURL: '/auth/error?from=link-microsoft',
        });
      }}
      variant="outline"
    >
      <FaMicrosoft className="mr-2 size-5" />
      <span>Link Microsoft Account</span>
    </Button>
  );
};

const AccountDetailsSkeleton = () => {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="flex items-center justify-start space-y-1">
        <User className="size-6 text-muted-foreground" />
        <CardTitle className="text-lg">Account Details</CardTitle>
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
