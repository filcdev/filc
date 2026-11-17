import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { user as userTable } from '#database/schema/authentication';
import { userPreferences } from '#modules/notifications/schema';
import type {
  AudienceUser,
  DeliveryJob,
  NotificationHandler,
  NotificationPreferences,
} from '#utils/notifications/types';

/**
 * `deliverToUser` reads the recipient's teacher link from `#database` and hands
 * the delivery to `#utils/notifications/queue`. Both are mocked before the
 * engine is imported: the real modules touch the environment at load time and
 * would put a live database and mail transport behind the assertions. The
 * engine import is dynamic for that reason — a static import would bind the
 * real modules first.
 */

type PrefRow = {
  userId: string;
  language: string;
  notificationPreferences?: Partial<NotificationPreferences>;
};

type UserRow = {
  cohortId: string | null;
  email: string;
  id: string;
  name: string;
};

const state: {
  inserts: { table: unknown; values: Record<string, unknown> }[];
  jobs: DeliveryJob[];
  linkedTeacher: boolean;
  prefRows: PrefRow[];
  /** Every table a `select().from(...)` touched, in call order. */
  selects: unknown[];
  userRows: UserRow[];
} = {
  inserts: [],
  jobs: [],
  linkedTeacher: false,
  prefRows: [],
  selects: [],
  userRows: [],
};

/**
 * A query result that can be awaited at `where(...)` or at
 * `where(...).limit(n)`, the two shapes the engine awaits.
 */
const rows = <T>(value: T[]) =>
  Object.assign(Promise.resolve(value), {
    limit: (count: number) => Promise.resolve(value.slice(0, count)),
  });

/** The rows a fake select answers with, chosen by table and selected columns. */
function rowsFor(table: unknown, columns: Record<string, unknown>): unknown[] {
  if (table === userPreferences) {
    return state.prefRows;
  }
  if (table === userTable) {
    // `deliverToUser` asks for the teacher predicate; the audience queries ask
    // for the user's own columns.
    return 'hasTeacher' in columns
      ? [{ hasTeacher: state.linkedTeacher }]
      : state.userRows;
  }
  return [];
}

const fakeDb = {
  insert: (table: unknown) => ({
    values: (values: Record<string, unknown>) => {
      state.inserts.push({ table, values });
      return {
        returning: () =>
          Promise.resolve([
            { id: `notification-${state.inserts.length}`, ...values },
          ]),
      };
    },
  }),
  select: (columns: Record<string, unknown> = {}) => ({
    from: (table: unknown) => {
      state.selects.push(table);
      return {
        where: () => rows(rowsFor(table, columns)),
      };
    },
  }),
};

const noop = () => undefined;

mock.module('@logtape/logtape', () => ({
  getLogger: () => ({
    debug: noop,
    error: noop,
    info: noop,
    trace: noop,
    warn: noop,
    warning: noop,
  }),
}));
mock.module('#database', () => ({ db: fakeDb }));
mock.module('#utils/notifications/queue', () => ({
  attemptJob: noop,
  enqueue: (job: DeliveryJob) => {
    state.jobs.push(job);
  },
}));

const { deliverToUser, enrichUsersWithLanguage, resolveAudienceForUser } =
  await import('#utils/notifications/engine');

const recipient = (overrides: Partial<AudienceUser> = {}): AudienceUser => ({
  cohortId: null,
  email: 'student@example.com',
  id: 'user-1',
  language: 'en',
  name: 'Student',
  ...overrides,
});

const handler = (
  overrides: Partial<NotificationHandler> = {}
): NotificationHandler => ({
  buildContent: () => ({ content: 'Body', title: 'Title' }),
  getAudience: async () => [],
  getDelay: () => 0,
  preferenceKey: 'substitution',
  type: 'substitution',
  ...overrides,
});

beforeEach(() => {
  state.inserts.length = 0;
  state.jobs.length = 0;
  state.linkedTeacher = false;
  state.prefRows.length = 0;
  state.selects.length = 0;
  state.userRows.length = 0;
});

afterAll(() => {
  mock.restore();
});

describe('deliverToUser', () => {
  it('writes and enqueues nothing for a type the user opted out of', async () => {
    await deliverToUser(
      'substitution',
      {},
      handler(),
      recipient({ notificationPreferences: { substitution: false } })
    );

    expect(state.inserts).toHaveLength(0);
    expect(state.jobs).toHaveLength(0);
  });

  it('delivers a system message despite email and type opt-outs', async () => {
    await deliverToUser(
      'system_message',
      {},
      handler({ preferenceKey: 'systemMessage', type: 'system_message' }),
      recipient({
        notificationPreferences: {
          channelsEnabled: false,
          emailEnabled: false,
          systemMessage: false,
        },
      })
    );

    expect(state.inserts).toHaveLength(1);
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0]?.emailEnabled).toBe(true);
  });

  it('merges the handler metadata with details and highlights', async () => {
    const details = [{ label: 'Time', value: '08:00' }];
    const highlights = ['Bring the workbook'];

    await deliverToUser(
      'substitution',
      {},
      handler({
        buildContent: () => ({
          content: 'Body',
          details,
          highlights,
          metadata: { action: 'open', slug: 'substitution-1' },
          title: 'Title',
        }),
      }),
      recipient()
    );

    expect(state.inserts[0]?.values.metadata).toEqual({
      action: 'open',
      details,
      highlights,
      slug: 'substitution-1',
    });
  });

  it('resolves emailEnabled from role defaults only when the stored row is silent', async () => {
    const delivered = async () => {
      await deliverToUser('substitution', {}, handler(), recipient());
      return state.jobs.at(-1)?.emailEnabled;
    };

    // No preferences row and no teacher link: the role default is off.
    expect(await delivered()).toBe(false);

    // A teacher with no stored email flag gets the role default (on).
    state.linkedTeacher = true;
    expect(await delivered()).toBe(true);

    // A stored flag wins over the role default, in both directions.
    expect(
      await deliverToUser(
        'substitution',
        {},
        handler(),
        recipient({ notificationPreferences: { emailEnabled: false } })
      ).then(() => state.jobs.at(-1)?.emailEnabled)
    ).toBe(false);

    state.linkedTeacher = false;
    expect(
      await deliverToUser(
        'substitution',
        {},
        handler(),
        recipient({ notificationPreferences: { emailEnabled: true } })
      ).then(() => state.jobs.at(-1)?.emailEnabled)
    ).toBe(true);
  });
});

describe('audience enrichment', () => {
  it('carries the stored notificationPreferences onto each audience member', async () => {
    state.prefRows.push({
      language: 'hu',
      notificationPreferences: { blogPost: true },
      userId: 'user-1',
    });

    const [member] = await enrichUsersWithLanguage([
      {
        cohortId: null,
        email: 'student@example.com',
        id: 'user-1',
        name: 'Student',
      },
    ]);

    expect(member?.language).toBe('hu');
    expect(member?.notificationPreferences).toEqual({ blogPost: true });
  });

  it('resolves a single recipient with the same preferences record', async () => {
    state.userRows.push({
      cohortId: 'cohort-1',
      email: 'student@example.com',
      id: 'user-1',
      name: 'Student',
    });
    state.prefRows.push({
      language: 'hu',
      notificationPreferences: { substitution: false },
      userId: 'user-1',
    });

    const [target] = await resolveAudienceForUser({ userId: 'user-1' });

    expect(target?.language).toBe('hu');
    expect(target?.notificationPreferences).toEqual({ substitution: false });
  });

  it('gates on the carried preferences without re-reading them', async () => {
    state.prefRows.push({
      language: 'hu',
      notificationPreferences: { blogPost: true },
      userId: 'user-1',
    });

    const [member] = await enrichUsersWithLanguage([
      {
        cohortId: null,
        email: 'student@example.com',
        id: 'user-1',
        name: 'Student',
      },
    ]);
    if (!member) {
      throw new Error('audience is empty');
    }

    state.selects.length = 0;
    await deliverToUser(
      'blog_post',
      {},
      handler({ preferenceKey: 'blogPost', type: 'blog_post' }),
      member
    );

    expect(state.selects).toContain(userTable);
    expect(state.selects).not.toContain(userPreferences);
    expect(state.jobs).toHaveLength(1);
  });
});
