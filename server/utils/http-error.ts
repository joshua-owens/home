// Nitro provides createError as a global at runtime; fall back to a plain Error
// so server utils can run under vitest without a Nitro server.
export const httpError =
  globalThis.createError ??
  ((error: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(error.statusMessage), error))
