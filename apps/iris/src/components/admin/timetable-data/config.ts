import {
  type ClientResponse,
  type InferRequestType,
  type InferResponseType,
  parseResponse,
} from 'hono/client';
import { api } from '@/utils/hc';

/** All base-data entities registered as CRUD resources. */
export type Resource = keyof typeof api.timetable.manage;

/** Row type of a resource's list response. */
export type RowOf<R extends Resource> = NonNullable<
  InferResponseType<(typeof api.timetable.manage)[R]['$get']>['data']
>[number];

/** Create body of a resource (the insert schema without server-managed columns). */
export type CreateJson<R extends Resource> = InferRequestType<
  (typeof api.timetable.manage)[R]['$post']
>['json'];

/** Update body of a resource (partial, without server-managed columns). */
export type UpdateJson<R extends Resource> = InferRequestType<
  (typeof api.timetable.manage)[R][':id']['$patch']
>['json'];

/** How a form/table field is rendered. */
export type FieldDef = {
  key: string;
  labelKey: string;
  type: 'checkbox' | 'number' | 'text';
  required?: boolean;
};

/** Strongly-typed API surface + metadata for one entity. */
export type EntityDef<TRow, TInput> = {
  api: EntityCrudApi<TRow, TInput>;
  fields: FieldDef[];
  resource: Resource;
  titleKey: string;
};

export type EntityCrudApi<TRow, TInput> = {
  create: (body: TInput) => Promise<TRow>;
  list: (params: { limit: number; offset: number; search: string }) => Promise<{
    rows: TRow[];
    total: number;
  }>;
  remove: (id: string) => Promise<void>;
  update: (id: string, body: Partial<TInput>) => Promise<TRow>;
};

/** Structural view of a resource client (any concrete resource matches). */
type ResourceClient = {
  $get: (args: {
    query: { limit: string; offset: string; search?: string };
  }) => Promise<ClientResponse<unknown>>;
  $post: (args: { json: unknown }) => Promise<ClientResponse<unknown>>;
  ':id': {
    $delete: (args: {
      param: { id: string };
    }) => Promise<ClientResponse<unknown>>;
    $patch: (args: {
      json: unknown;
      param: { id: string };
    }) => Promise<ClientResponse<unknown>>;
  };
};

/** Strongly-typed CRUD api for one resource, with rows/inputs typed to TRow/TInput. */
function makeCrudApi<TRow, TInput>(
  client: ResourceClient
): EntityCrudApi<TRow, TInput> {
  return {
    async create(body) {
      const res = (await parseResponse(
        client.$post({ json: body })
      )) as unknown as {
        data: TRow;
      };
      return res.data;
    },
    async list(params) {
      const query: { limit: string; offset: string; search?: string } = {
        limit: params.limit.toString(),
        offset: params.offset.toString(),
      };
      if (params.search) {
        query.search = params.search;
      }
      const res = (await parseResponse(client.$get({ query }))) as unknown as {
        data: TRow[];
        total: number;
      };
      return { rows: res.data, total: res.total };
    },
    async remove(id) {
      await parseResponse(client[':id'].$delete({ param: { id } }));
    },
    async update(id, body) {
      const res = (await parseResponse(
        client[':id'].$patch({ json: body, param: { id } })
      )) as unknown as { data: TRow };
      return res.data;
    },
  };
}

function makeEntity<R extends Resource>(
  resource: R,
  fields: FieldDef[],
  titleKey: string
): EntityDef<RowOf<R>, CreateJson<R>> {
  return {
    api: makeCrudApi<RowOf<R>, CreateJson<R>>(api.timetable.manage[resource]),
    fields,
    resource,
    titleKey,
  };
}

export const entities = {
  buildings: makeEntity(
    'buildings',
    [{ key: 'name', labelKey: 'entity.name', required: true, type: 'text' }],
    'entity.buildings'
  ),
  classrooms: makeEntity(
    'classrooms',
    [
      { key: 'name', labelKey: 'entity.name', required: true, type: 'text' },
      { key: 'short', labelKey: 'entity.short', required: true, type: 'text' },
      { key: 'buildingId', labelKey: 'entity.building', type: 'text' },
      { key: 'capacity', labelKey: 'entity.capacity', type: 'number' },
    ],
    'entity.classrooms'
  ),
  dayDefinitions: makeEntity(
    'dayDefinitions',
    [
      { key: 'name', labelKey: 'entity.name', required: true, type: 'text' },
      { key: 'short', labelKey: 'entity.short', required: true, type: 'text' },
    ],
    'entity.dayDefinitions'
  ),
  periods: makeEntity(
    'periods',
    [
      {
        key: 'period',
        labelKey: 'entity.period',
        required: true,
        type: 'number',
      },
      {
        key: 'startTime',
        labelKey: 'entity.startTime',
        required: true,
        type: 'text',
      },
      {
        key: 'endTime',
        labelKey: 'entity.endTime',
        required: true,
        type: 'text',
      },
    ],
    'entity.periods'
  ),
  subjects: makeEntity(
    'subjects',
    [
      { key: 'name', labelKey: 'entity.name', required: true, type: 'text' },
      { key: 'short', labelKey: 'entity.short', required: true, type: 'text' },
    ],
    'entity.subjects'
  ),
  termDefinitions: makeEntity(
    'termDefinitions',
    [
      { key: 'name', labelKey: 'entity.name', required: true, type: 'text' },
      { key: 'short', labelKey: 'entity.short', required: true, type: 'text' },
    ],
    'entity.termDefinitions'
  ),
  weekDefinitions: makeEntity(
    'weekDefinitions',
    [
      { key: 'name', labelKey: 'entity.name', required: true, type: 'text' },
      { key: 'short', labelKey: 'entity.short', required: true, type: 'text' },
    ],
    'entity.weekDefinitions'
  ),
};

export type EntityResource = keyof typeof entities;

export const entityKeys = Object.keys(entities) as EntityResource[];
