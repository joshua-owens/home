/**
 * Copy only the listed keys from a patch object, skipping undefined values.
 * Used to whitelist updatable fields and prevent mass-assignment.
 */
export function pickDefined<T extends object, K extends keyof T>(
  patch: Partial<T>,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {}
  for (const key of keys) {
    if (patch[key] !== undefined) result[key] = patch[key]
  }
  return result
}
