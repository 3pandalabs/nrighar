import { and, eq } from "drizzle-orm";
import { ApplicationFailure } from "@temporalio/common";
import { db, schema } from "../../db/index.js";

type PropertyBody = {
  nickname: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  propertyType?: "apartment" | "independent_house" | "villa" | "plot" | "commercial";
  notes?: string;
};

export async function listProperties(input: { ownerId: string }) {
  return db.select().from(schema.properties).where(eq(schema.properties.ownerId, input.ownerId));
}

export async function createProperty(input: { ownerId: string; body: PropertyBody }) {
  const [row] = await db
    .insert(schema.properties)
    .values({ ...input.body, ownerId: input.ownerId })
    .returning();
  return row;
}

export async function getProperty(input: { id: string; ownerId: string }) {
  const [row] = await db
    .select()
    .from(schema.properties)
    .where(and(eq(schema.properties.id, input.id), eq(schema.properties.ownerId, input.ownerId)));
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return row;
}

export async function updateProperty(input: { id: string; ownerId: string; body: Partial<PropertyBody> }) {
  const [row] = await db
    .update(schema.properties)
    .set(input.body)
    .where(and(eq(schema.properties.id, input.id), eq(schema.properties.ownerId, input.ownerId)))
    .returning();
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return row;
}

export async function deleteProperty(input: { id: string; ownerId: string }) {
  const [row] = await db
    .delete(schema.properties)
    .where(and(eq(schema.properties.id, input.id), eq(schema.properties.ownerId, input.ownerId)))
    .returning({ id: schema.properties.id });
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
}
