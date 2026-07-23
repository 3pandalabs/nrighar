import { Client, Connection } from "@temporalio/client";
import { temporalEnv } from "./env.js";

// Lazy singleton: the Fastify app and any one-off scripts (triggerPing.ts)
// share this so they don't each open a new gRPC connection per call.
let clientPromise: Promise<Client> | undefined;

export function getTemporalClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = Connection.connect({ address: temporalEnv.address }).then(
      (connection) => new Client({ connection, namespace: temporalEnv.namespace }),
    );
  }
  return clientPromise;
}
