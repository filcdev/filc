import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { db } from '~/database';
import { featureFlag } from '~/database/schema/feature-flag';

const logger = getLogger(['chronos', 'feature-flag']);

export const handleFeatureFlag = async (
  name: string,
  description: string,
  defaultEnabled: boolean
) => {
  const [existingFlag] = await db
    .select()
    .from(featureFlag)
    .where(eq(featureFlag.name, name));
  if (!existingFlag) {
    logger.debug(
      `Registering feature flag: ${name} - ${description} (default: ${defaultEnabled})`
    );
    await db
      .insert(featureFlag)
      .values({ name, description, isEnabled: defaultEnabled })
      .returning();
    return defaultEnabled;
  }

  return existingFlag.isEnabled;
};
