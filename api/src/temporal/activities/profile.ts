import { eq } from "drizzle-orm";
import { ApplicationFailure } from "@temporalio/common";
import { db, schema } from "../../db/index.js";

type ProfilePatchBody = {
  displayName?: string;
  countryOfResidence?: string;
  preferredCurrency?: string;
  upiVpa?: string;
  upiName?: string;
};

export async function getProfile(input: { userId: string }) {
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.id, input.userId));
  if (!profile) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return profile;
}

export async function updateProfile(input: { userId: string; body: ProfilePatchBody }) {
  const [updated] = await db
    .update(schema.profiles)
    .set(input.body)
    .where(eq(schema.profiles.id, input.userId))
    .returning();
  if (!updated) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return updated;
}
