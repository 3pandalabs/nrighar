// Trivial activity to prove worker <-> server connectivity end to end.
export async function ping(message: string): Promise<string> {
  return `pong: ${message}`;
}
