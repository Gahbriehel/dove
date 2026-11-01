export type MockModel = Record<string, jest.Mock>;

/** Typed access to the first argument of the nth call made to a mock. */
export function callArg<
  T = { data: Record<string, unknown>; where: Record<string, unknown> },
>(fn: jest.Mock, call = 0): T {
  const calls = fn.mock.calls as unknown[][];
  return calls[call][0] as T;
}
