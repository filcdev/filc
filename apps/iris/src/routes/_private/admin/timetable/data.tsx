import { createFileRoute } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type EntityResource,
  entities,
  entityKeys,
} from '@/components/admin/timetable-data/config';
import { EntityManager } from '@/components/admin/timetable-data/entity-manager';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

export const Route = createFileRoute('/_private/admin/timetable/data')({
  component: TimetableDataPage,
});

function TimetableDataPage() {
  const { t } = useTranslation();
  const [resource, setResource] = useState<EntityResource>(
    entityKeys[0] as EntityResource
  );

  const managers: Record<EntityResource, ReactNode> = {
    buildings: (
      <EntityManager
        entity={entities.buildings}
        queryKey={['timetable-data', 'buildings']}
      />
    ),
    classrooms: (
      <EntityManager
        entity={entities.classrooms}
        queryKey={['timetable-data', 'classrooms']}
      />
    ),
    dayDefinitions: (
      <EntityManager
        entity={entities.dayDefinitions}
        queryKey={['timetable-data', 'dayDefinitions']}
      />
    ),
    periods: (
      <EntityManager
        entity={entities.periods}
        queryKey={['timetable-data', 'periods']}
      />
    ),
    subjects: (
      <EntityManager
        entity={entities.subjects}
        queryKey={['timetable-data', 'subjects']}
      />
    ),
    termDefinitions: (
      <EntityManager
        entity={entities.termDefinitions}
        queryKey={['timetable-data', 'termDefinitions']}
      />
    ),
    weekDefinitions: (
      <EntityManager
        entity={entities.weekDefinitions}
        queryKey={['timetable-data', 'weekDefinitions']}
      />
    ),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('entity.title')}
        </h1>
        <p className="text-muted-foreground">{t('entity.description')}</p>
      </div>

      <Select
        items={entityKeys.map((key) => ({
          label: t(entities[key].titleKey),
          value: key,
        }))}
        onValueChange={(value) =>
          setResource((value ?? entityKeys[0]) as EntityResource)
        }
        value={resource}
      >
        <SelectTrigger />
        <SelectContent>
          {entityKeys.map((key) => (
            <SelectItem key={key} value={key}>
              {t(entities[key].titleKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {managers[resource]}
    </div>
  );
}
