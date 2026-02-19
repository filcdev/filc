import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
import {
  type InferRequestType,
  type InferResponseType,
  parseResponse,
} from 'hono/client';
import { Pen, Plus, RefreshCw, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { SubstitutionDialog } from '@/components/admin/substitution-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PermissionGuard } from '@/components/util/permission-guard';
import { authClient } from '@/utils/authentication';
import { confirmDestructiveAction } from '@/utils/confirm';
import { api } from '@/utils/hc';

type SubstitutionApiResponse = InferResponseType<
  typeof api.timetable.substitutions.$get
>;
type SubstitutionItem = NonNullable<SubstitutionApiResponse['data']>[number];
type EnrichedLesson = NonNullable<SubstitutionItem['lessons'][number]>;
type Teacher = NonNullable<SubstitutionItem['teacher']>;

export const Route = createFileRoute('/_private/admin/timetable/substitutions')(
  {
    component: () => (
      <PermissionGuard permission="substitution:create">
        <SubstitutionsPage />
      </PermissionGuard>
    ),
  }
);

function SubstitutionsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SubstitutionItem | null>(
    null
  );

  const hasWritePermission = useHasPermission(
    'substitution:create',
    session?.user?.permissions
  );

  const substitutionsQuery = useQuery({
    queryFn: async (): Promise<SubstitutionItem[]> => {
      const res = await parseResponse(api.timetable.substitutions.$get());
      if (!res.success) {
        throw new Error('Failed to load substitutions');
      }
      return res.data as SubstitutionItem[];
    },
    queryKey: ['substitutions'],
  });

  const teachersQuery = useQuery({
    enabled: hasWritePermission,
    queryFn: async (): Promise<Teacher[]> => {
      const res = await parseResponse(api.timetable.teachers.getAll.$get());
      if (!(res.success && res.data)) {
        throw new Error('Failed to load teachers');
      }
      return res.data as Teacher[];
    },
    queryKey: ['teachers'],
  });

  const cohortsQuery = useQuery({
    enabled: hasWritePermission,
    queryFn: async () => {
      const res = await parseResponse(api.cohort.index.$get());
      if (!res.success) {
        throw new Error('Failed to load cohorts');
      }
      return res.data;
    },
    queryKey: ['cohorts'],
  });

  // Get all lessons from all substitutions for the lesson picker
  const allLessons = useMemo(() => {
    const subs = substitutionsQuery.data ?? [];
    const lessonMap = new Map<string, EnrichedLesson>();
    for (const sub of subs) {
      for (const lesson of sub.lessons) {
        if (!lesson) {
          continue;
        }
        lessonMap.set(lesson.id, lesson);
      }
    }
    return Array.from(lessonMap.values());
  }, [substitutionsQuery.data]);

  const $create = api.timetable.substitutions.$post;
  const createMutation = useMutation<
    InferResponseType<typeof $create>,
    Error,
    InferRequestType<typeof $create>['json']
  >({
    mutationFn: async (payload) => {
      const res = await parseResponse(
        api.timetable.substitutions.$post({
          json: payload,
        })
      );
      if (!res.success) {
        throw new Error('Failed to create substitution');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('substitution.createError'));
    },
    onSuccess: () => {
      toast.success(t('substitution.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['substitutions'] });
      setDialogOpen(false);
      setSelectedItem(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: InferRequestType<typeof $create>['json'];
    }) => {
      const res = await parseResponse(
        api.timetable.substitutions[':id'].$put({
          json: payload,
          param: { id },
        })
      );
      if (!res.success) {
        throw new Error('Failed to update substitution');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('substitution.updateError'));
    },
    onSuccess: () => {
      toast.success(t('substitution.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['substitutions'] });
      setDialogOpen(false);
      setSelectedItem(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      parseResponse(
        api.timetable.substitutions[':id'].$delete({ param: { id } })
      ),
    onError: (error: Error) => {
      toast.error(error.message || t('substitution.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('substitution.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['substitutions'] });
    },
  });

  const filteredSubstitutions = useMemo(() => {
    const list = substitutionsQuery.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) {
      return list;
    }
    return list.filter((sub) => {
      const teacherName = sub.teacher
        ? `${sub.teacher.firstName} ${sub.teacher.lastName}`.toLowerCase()
        : '';
      const lessons = sub.lessons.filter((l) => l !== null && l !== undefined);

      const lessonSubjects = lessons
        .map((l) => l.subject?.name ?? '')
        .join(' ')
        .toLowerCase();
      const cohorts = lessons
        .flatMap((l) => l.cohorts)
        .join(' ')
        .toLowerCase();
      return (
        sub.substitution.date.includes(term) ||
        teacherName.includes(term) ||
        lessonSubjects.includes(term) ||
        cohorts.includes(term)
      );
    });
  }, [substitutionsQuery.data, search]);

  const handleSave = async (
    payload: InferRequestType<typeof $create>['json']
  ) => {
    if (selectedItem) {
      await updateMutation.mutateAsync({
        id: selectedItem.substitution.id,
        payload,
      });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const handleDelete = async (sub: SubstitutionItem) => {
    if (!hasWritePermission) {
      return;
    }
    const confirmed = confirmDestructiveAction(t('substitution.deleteConfirm'));
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync(sub.substitution.id);
  };

  const isLoading = substitutionsQuery.isLoading;
  const hasError = substitutionsQuery.isError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('substitution.title')}
        </h1>
        <p className="text-muted-foreground">{t('substitution.description')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('search')}
          value={search}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button
            onClick={() => substitutionsQuery.refetch()}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4" />
            {t('substitution.refresh')}
          </Button>
          {hasWritePermission && (
            <Button
              onClick={() => {
                setSelectedItem(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t('substitution.create')}
            </Button>
          )}
        </div>
      </div>

      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>{t('substitution.loadError')}</AlertTitle>
          <AlertDescription>
            {(substitutionsQuery.error as Error)?.message ??
              t('substitution.loadErrorMessage')}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('substitution.date')}</TableHead>
              <TableHead>{t('substitution.substituteTeacher')}</TableHead>
              <TableHead>{t('substitution.affectedLessons')}</TableHead>
              <TableHead>{t('substitution.cohorts')}</TableHead>
              {hasWritePermission && (
                <TableHead>{t('substitution.actions')}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubstitutions.map((sub) => (
              <TableRow key={sub.substitution.id}>
                <TableCell className="font-medium">
                  {dayjs(sub.substitution.date).format('YYYY/MM/DD')}
                </TableCell>
                <TableCell>
                  {sub.teacher ? (
                    `${sub.teacher.firstName} ${sub.teacher.lastName}`
                  ) : (
                    <Badge variant="destructive">
                      {t('substitution.cancelled')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {sub.lessons.length > 0
                    ? sub.lessons
                        .map(
                          (l) =>
                            `${l?.subject?.short ?? '?'} P${l?.period?.period ?? '?'}`
                        )
                        .join(', ')
                    : t('substitution.noLessons')}
                </TableCell>
                <TableCell>
                  {Array.from(
                    new Set(sub.lessons.flatMap((l) => l?.cohorts))
                  ).join(', ') || '-'}
                </TableCell>
                {hasWritePermission && (
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setSelectedItem(sub);
                          setDialogOpen(true);
                        }}
                        size="icon"
                        variant="outline"
                      >
                        <Pen className="h-4 w-4" />
                      </Button>
                      <Button
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(sub)}
                        size="icon"
                        variant="destructive"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!(filteredSubstitutions.length || hasError) && (
              <TableRow>
                <TableCell
                  className="text-muted-foreground"
                  colSpan={hasWritePermission ? 5 : 4}
                >
                  {t('substitution.noSubstitutions')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {hasWritePermission && (
        <SubstitutionDialog
          allLessons={allLessons}
          cohorts={cohortsQuery.data?.filter((c) => c !== undefined) ?? []}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          item={selectedItem}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setSelectedItem(null);
            }
          }}
          onSubmit={handleSave}
          open={dialogOpen}
          teachers={teachersQuery.data ?? []}
        />
      )}
    </div>
  );
}

function useHasPermission(permission: string, permissions?: string[] | null) {
  if (!permissions) {
    return false;
  }
  if (permissions.includes('*')) {
    return true;
  }
  return permissions.includes(permission);
}
