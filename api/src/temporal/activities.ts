// Trivial activity to prove worker <-> server connectivity end to end. Real
// activities (WhatsApp sends, payment reconciliation, etc.) land here later.
export async function ping(message: string): Promise<string> {
  return `pong: ${message}`;
}
