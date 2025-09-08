import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { db } from '~/database';
import { featureFlag } from '~/database/schema/feature-flag';

const logger = getLogger(['chronos', 'feature-flag']);

export const registerFeatureFlag = async (
  name: string,
  description: string
) => {
  const [existingFlag] = await db
    .select()
    .from(featureFlag)
    .where(eq(featureFlag.name, name));
  if (!existingFlag) {
    db.insert(featureFlag).values({ name, description }).returning();
  }

  return true;
};

export const isFeatureEnabled = async (name: string) => {
  const [flag] = await db
    .select()
    .from(featureFlag)
    .where(eq(featureFlag.name, name));
  if (!flag) {
    logger.error(`Feature flag "${name}" not found, did you register it?`);
    return false;
  }
  return flag.isEnabled;
};
