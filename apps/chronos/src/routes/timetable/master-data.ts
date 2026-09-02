import { permissions } from '@filcdev/api/permissions';
import { asc } from 'drizzle-orm';
import {
  building,
  classroom,
  dayDefinition,
  period,
  subject,
  termDefinition,
  weekDefinition,
} from '#database/schema/timetable';
import { createCrudHandlers } from '#utils/crud';
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from '#utils/zod';

/**
 * Full CRUD for the flat reference-data entities that underpin the timetable
 * editor. These have no cross-table relations to validate (FK integrity is
 * enforced by the database), so a single generic generator covers them.
 * Teacher / cohort / group (which do have relations) get dedicated handlers.
 */
const writePermission = permissions.timetableDataManage;

// The schemas are derived here with the concrete table so the column types are
// known; the generator only wires the handlers. Server-managed columns (id and
// timestamps) are excluded from the request bodies.

export const subjectCrud = await createCrudHandlers({
  idColumn: subject.id,
  insertSchema: createInsertSchema(subject).omit({ id: true }),
  orderBy: [asc(subject.name)],
  permission: writePermission,
  resource: 'subjects',
  searchable: [subject.name, subject.short],
  selectSchema: createSelectSchema(subject),
  table: subject,
  updateSchema: createUpdateSchema(subject).omit({ id: true }),
});

export const buildingCrud = await createCrudHandlers({
  idColumn: building.id,
  insertSchema: createInsertSchema(building).omit({ id: true }),
  orderBy: [asc(building.name)],
  permission: writePermission,
  resource: 'buildings',
  searchable: [building.name],
  selectSchema: createSelectSchema(building),
  table: building,
  updateSchema: createUpdateSchema(building).omit({ id: true }),
});

export const classroomCrud = await createCrudHandlers({
  idColumn: classroom.id,
  insertSchema: createInsertSchema(classroom).omit({ id: true }),
  orderBy: [asc(classroom.name)],
  permission: writePermission,
  resource: 'classrooms',
  searchable: [classroom.name, classroom.short],
  selectSchema: createSelectSchema(classroom),
  table: classroom,
  updateSchema: createUpdateSchema(classroom).omit({ id: true }),
});

export const periodCrud = await createCrudHandlers({
  idColumn: period.id,
  insertSchema: createInsertSchema(period).omit({ id: true }),
  orderBy: [asc(period.period)],
  permission: writePermission,
  resource: 'periods',
  selectSchema: createSelectSchema(period),
  table: period,
  updateSchema: createUpdateSchema(period).omit({ id: true }),
});

export const dayDefinitionCrud = await createCrudHandlers({
  idColumn: dayDefinition.id,
  insertSchema: createInsertSchema(dayDefinition).omit({ id: true }),
  orderBy: [asc(dayDefinition.short)],
  permission: writePermission,
  resource: 'dayDefinitions',
  searchable: [dayDefinition.name, dayDefinition.short],
  selectSchema: createSelectSchema(dayDefinition),
  table: dayDefinition,
  updateSchema: createUpdateSchema(dayDefinition).omit({ id: true }),
});

export const weekDefinitionCrud = await createCrudHandlers({
  idColumn: weekDefinition.id,
  insertSchema: createInsertSchema(weekDefinition).omit({ id: true }),
  orderBy: [asc(weekDefinition.short)],
  permission: writePermission,
  resource: 'weekDefinitions',
  searchable: [weekDefinition.name, weekDefinition.short],
  selectSchema: createSelectSchema(weekDefinition),
  table: weekDefinition,
  updateSchema: createUpdateSchema(weekDefinition).omit({ id: true }),
});

export const termDefinitionCrud = await createCrudHandlers({
  idColumn: termDefinition.id,
  insertSchema: createInsertSchema(termDefinition).omit({ id: true }),
  orderBy: [asc(termDefinition.short)],
  permission: writePermission,
  resource: 'termDefinitions',
  searchable: [termDefinition.name, termDefinition.short],
  selectSchema: createSelectSchema(termDefinition),
  table: termDefinition,
  updateSchema: createUpdateSchema(termDefinition).omit({ id: true }),
});
