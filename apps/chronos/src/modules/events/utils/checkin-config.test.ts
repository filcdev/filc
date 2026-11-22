import { describe, expect, it } from 'bun:test';
import { eventCheckinConfigUpsertSchema } from '@filcdev/api/domains/events/checkin-config';
import type { EventCheckinRule } from '@filcdev/api/domains/events/rules';
import {
  type CheckinConfigChoice,
  pickCheckinConfig,
} from '#modules/events/utils/checkin-config';

const EVENT_ID = '5b4d1f1e-9c3a-4a2e-8b1f-0d2c3b4a5f60';
const USER_A = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';
const USER_B = '4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f7a';

const allow = (id: string): EventCheckinRule => ({
  action: 'allow',
  id,
  message: '',
  show: { email: false, fieldIds: [], name: true },
  when: null,
});

const deny = (id: string): EventCheckinRule => ({
  action: 'deny',
  id,
  message: 'Nem léphet be',
  show: { email: false, fieldIds: [], name: true },
  when: null,
});

const ALLOW_RULE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const DENY_RULE_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

const defaultConfig = (): CheckinConfigChoice => ({
  rules: [allow(ALLOW_RULE_ID)],
  userId: null,
});
const overrideConfig = (userId: string): CheckinConfigChoice => ({
  rules: [deny(DENY_RULE_ID)],
  userId,
});

/**
 * Which config judges a scan: the scanning helper's own override first, the
 * event default second. The order is the whole feature, so it is asserted
 * without a database; the handler only binds these rows to it.
 */
describe('pickCheckinConfig', () => {
  it('prefers the scanner own override over the event default', () => {
    const chosen = pickCheckinConfig(
      [defaultConfig(), overrideConfig(USER_A)],
      USER_A
    );

    expect(chosen?.userId).toBe(USER_A);
    expect(chosen?.rules[0]?.action).toBe('deny');
  });

  it('uses the event default for a helper without an override', () => {
    const chosen = pickCheckinConfig(
      [defaultConfig(), overrideConfig(USER_A)],
      USER_B
    );

    expect(chosen?.userId).toBeNull();
    expect(chosen?.rules[0]?.action).toBe('allow');
  });

  it('answers null when neither the helper nor the event has a config', () => {
    expect(pickCheckinConfig([], USER_A)).toBeNull();
    expect(pickCheckinConfig([overrideConfig(USER_A)], USER_B)).toBeNull();
  });
});

/** The write body the API accepts; the handlers add the event id. */
describe('eventCheckinConfigUpsertSchema', () => {
  const rule = allow(ALLOW_RULE_ID);

  it('accepts the event default and a helper override', () => {
    expect(
      eventCheckinConfigUpsertSchema.safeParse({
        id: EVENT_ID,
        rules: [rule],
        userId: null,
      }).success
    ).toBe(true);
    expect(
      eventCheckinConfigUpsertSchema.safeParse({
        id: EVENT_ID,
        rules: [rule],
        userId: USER_A,
      }).success
    ).toBe(true);
  });

  it('rejects a rule with an unknown action', () => {
    expect(
      eventCheckinConfigUpsertSchema.safeParse({
        id: EVENT_ID,
        rules: [{ ...rule, action: 'maybe' }],
        userId: null,
      }).success
    ).toBe(false);
  });
});
