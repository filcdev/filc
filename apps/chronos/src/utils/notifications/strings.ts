/** Deduplicated, non-empty strings in first-seen order. Shared by the email
 * detail builders (substitution and moved lesson). */
export const uniqueStrings = (
  values: (string | null | undefined)[]
): string[] => [...new Set(values.filter((value): value is string => !!value))];
