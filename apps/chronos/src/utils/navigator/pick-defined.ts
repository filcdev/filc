type PickDefined<T> = {
  [K in keyof T as T[K] extends undefined ? never : K]: T[K];
};

/**
 * Drop keys whose value is `undefined`, so a `.partial()` payload can be
 * passed to drizzle's `.set()` without emitting invalid SQL for missing fields.
 */
export const pickDefined = <T extends object>(source: T): PickDefined<T> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as PickDefined<T>;
};
