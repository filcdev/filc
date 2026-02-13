import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { parseResponse } from 'hono/client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SubstitutionDialog } from '@/components/admin/substitution-dialog';
import { SubstitutionsTable } from '@/components/admin/substitutions-table';
import { Button } from '@/components/ui/button';
import { api } from '@/utils/hc';

type Teacher = {
  firstName: string;
  gender: string | null;
  id: string;
  lastName: string;
  short: string;
  userId: string | null;
};

type Cohort = {
  id: string;
  name: string;
};

type EnrichedLesson = {
  classrooms: { id: string; name: string; short: string }[];
  cohorts: string[];
  day: { id: string; name: string; short: string } | null;
  id: string;
  period: {
    endTime: string;
    id: string;
    period: number;
    startTime: string;
  } | null;
  subject: { id: string; name: string; short: string } | null;
  teachers: { id: string; name: string; short: string }[];
};

type SubstitutionEntry = {
  lessons: EnrichedLesson[];
  substitution: {
    date: string;
    id: string;
    substituter: string | null;
  };
  teacher: Teacher | null;
};

export const Route = createFileRoute('/_private/admin/substitutions')({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSubstitution, setEditingSubstitution] =
    useState<SubstitutionEntry | null>(null);

  const subsQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(api.timetable.substitutions.$get());
      if (!res.success) {
        throw new Error('Failed to load substitutions');
      }
      return res.data as SubstitutionEntry[];
    },
    queryKey: ['substitutions'],
  });

  const teachersQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(api.timetable.teachers.getAll.$get());
      if (!res.success) {
        throw new Error('Failed to load teachers');
      }
      return res.data as Teacher[];
    },
    queryKey: ['teachers'],
  });

  const cohortsQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(api.cohort.index.$get());
      if (!res.success) {
        throw new Error('Failed to load cohorts');
      }
      return (res.data ?? []) as Cohort[];
    },
    queryKey: ['cohorts'],
  });

  // Extract enriched lessons from substitutions data
  const allLessons = useMemo(() => {
    if (!subsQuery.data) {
      return [];
    }
    const lessonMap = new Map<string, EnrichedLesson>();
    for (const sub of subsQuery.data) {
      for (const lesson of sub.lessons) {
        lessonMap.set(lesson.id, lesson);
      }
    }
    return Array.from(lessonMap.values());
  }, [subsQuery.data]);

  const createSubstitutionMutation = useMutation({
    mutationFn: async (payload: {
      date: string;
      lessonIds: string[];
      substituter: string | null;
    }) => {
      const res = await parseResponse(
        api.timetable.substitutions.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to create substitution');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['substitutions'] });
      setIsCreateDialogOpen(false);
    },
  });

  const updateSubstitutionMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        date?: string;
        lessonIds?: string[];
        substituter?: string | null;
      };
    }) => {
      const res = await parseResponse(
        api.timetable.substitutions[':id'].$put(
          { param: { id } },
          {
            init: { body: JSON.stringify(payload) },
          }
        )
      );
      if (!res.success) {
        throw new Error('Failed to update substitution');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['substitutions'] });
      setEditingSubstitution(null);
    },
  });

  const deleteSubstitutionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await parseResponse(
        api.timetable.substitutions[':id'].$delete({
          param: { id },
        })
      );
      if (!res.success) {
        throw new Error('Failed to delete substitution');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['substitutions'] });
    },
  });

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-2xl">{t('substitutionsAdmin.title')}</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          {t('substitutionsAdmin.createSubstitution')}
        </Button>
      </div>
      {(() => {
        if (subsQuery.isLoading) {
          return <p>{t('common.loading')}</p>;
        }
        if (subsQuery.isError) {
          return (
            <p className="text-red-500">{t('substitutionsAdmin.loadError')}</p>
          );
        }
        if (!subsQuery.data) {
          return <p>{t('substitutionsAdmin.noSubstitutions')}</p>;
        }
        const filteredSubstitutions = subsQuery.data.filter((sub) =>
          sub.lessons?.every((lesson) => lesson !== null)
        );
        return (
          <SubstitutionsTable
            onDelete={(id) => deleteSubstitutionMutation.mutate(id)}
            onEdit={(sub) => setEditingSubstitution(sub)}
            substitutions={filteredSubstitutions}
          />
        );
      })()}
      <SubstitutionDialog
        allLessons={allLessons}
        cohorts={cohortsQuery.data ?? []}
        isSubmitting={createSubstitutionMutation.isPending}
        item={null}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={async (payload) => {
          await createSubstitutionMutation.mutateAsync(payload);
        }}
        open={isCreateDialogOpen}
        teachers={teachersQuery.data ?? []}
      />
      <SubstitutionDialog
        allLessons={allLessons}
        cohorts={cohortsQuery.data ?? []}
        isSubmitting={updateSubstitutionMutation.isPending}
        item={editingSubstitution}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSubstitution(null);
          }
        }}
        onSubmit={async (payload) => {
          if (editingSubstitution) {
            await updateSubstitutionMutation.mutateAsync({
              id: editingSubstitution.substitution.id,
              payload,
            });
          }
        }}
        open={!!editingSubstitution}
        teachers={teachersQuery.data ?? []}
      />
    </div>
  );
}
