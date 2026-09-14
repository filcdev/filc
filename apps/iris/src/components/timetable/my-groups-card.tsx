import { Alert, AlertTitle } from '@filcdev/ui/components/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import { useTranslation } from 'react-i18next';
import { useGroupsForCohort } from '@/hooks/timetable-groups';
import { DivisionGroupPicker } from './group-picker';

type MyGroupsSettingsCardProps = {
  cohortId: string | null;
};

/**
 * The "My groups" settings card: lets a student pick which group they belong
 * to in each division of their class (one group per division).
 */
export function MyGroupsSettingsCard({ cohortId }: MyGroupsSettingsCardProps) {
  const { t } = useTranslation();
  const groupsQuery = useGroupsForCohort(cohortId);

  const renderContent = () => {
    if (!cohortId) {
      return (
        <p className="text-muted-foreground text-sm">
          {t('preferences.myGroupsNoClass')}
        </p>
      );
    }
    if (groupsQuery.isLoading) {
      return <Skeleton className="h-24 w-full" />;
    }
    if (groupsQuery.isError) {
      return (
        <Alert variant="destructive">
          <AlertTitle>{t('preferences.myGroupsError')}</AlertTitle>
        </Alert>
      );
    }
    if ((groupsQuery.data ?? []).length === 0) {
      return (
        <p className="text-muted-foreground text-sm">
          {t('preferences.myGroupsNone')}
        </p>
      );
    }
    return <DivisionGroupPicker groups={groupsQuery.data ?? []} />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('preferences.myGroups')}</CardTitle>
        <CardDescription>
          {t('preferences.myGroupsDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{renderContent()}</CardContent>
    </Card>
  );
}
