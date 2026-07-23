import { and, eq } from "drizzle-orm";
import { log } from "@temporalio/activity";
import { ApplicationFailure } from "@temporalio/common";
import { db, schema } from "../../db/index.js";
import { deleteObject } from "../../plugins/r2.js";

type DocumentBody = {
  propertyId?: string;
  leaseId?: string;
  docType?: "agreement" | "kyc" | "property_paper" | "tax" | "other";
  title: string;
  storagePath: string;
};

export async function listDocuments(input: { ownerId: string }) {
  return db.select().from(schema.documents).where(eq(schema.documents.ownerId, input.ownerId));
}

export async function createDocument(input: { ownerId: string; body: DocumentBody }) {
  const [row] = await db
    .insert(schema.documents)
    .values({ ...input.body, ownerId: input.ownerId })
    .returning();
  return row;
}

export async function deleteDocument(input: { id: string; ownerId: string }) {
  const [existing] = await db
    .select({ storagePath: schema.documents.storagePath })
    .from(schema.documents)
    .where(and(eq(schema.documents.id, input.id), eq(schema.documents.ownerId, input.ownerId)));
  if (!existing) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  try {
    await deleteObject(existing.storagePath);
  } catch (err) {
    log.warn("failed to delete R2 object for document", { err, id: input.id });
  }
  await db
    .delete(schema.documents)
    .where(and(eq(schema.documents.id, input.id), eq(schema.documents.ownerId, input.ownerId)));
}
