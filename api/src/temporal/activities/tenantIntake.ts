import { eq } from "drizzle-orm";
import { ApplicationFailure } from "@temporalio/common";
import { db, schema } from "../../db/index.js";

// Split in two around the R2 write, which must happen in the Fastify handler
// (raw file bytes can't cross a Temporal payload boundary — see
// finalizeIntakeSubmission below). Validating first, before any R2 write,
// means an invalid/expired token never leaves orphaned objects — only a
// finalize-step failure after a valid submission can, matching the existing
// non-atomic put-then-insert loop's own accepted risk.
export async function validateIntakeLinkForSubmission(input: { token: string }) {
  const [link] = await db.select().from(schema.intakeLinks).where(eq(schema.intakeLinks.id, input.token));
  if (!link) throw ApplicationFailure.create({ type: "This link doesn't exist", nonRetryable: true });
  if (link.status !== "pending") {
    throw ApplicationFailure.create({ type: "This link was already used", nonRetryable: true });
  }
  if (link.expiresAt < new Date()) {
    throw ApplicationFailure.create({ type: "This link has expired", nonRetryable: true });
  }
  return { ownerId: link.ownerId, propertyId: link.propertyId };
}

// Ports supabase/functions/tenant-intake/index.ts's post-validation half.
// Files land in the OWNER's R2 prefix (<ownerId>/intake/<token>/...) so the
// owner's normal storage access covers them — the anonymous submitter never
// gets a read path back, matching the old Edge Function's
// service-role-bypass trust model exactly. Receives only the R2 keys the
// Fastify handler already wrote to, never raw file bytes.
export async function finalizeIntakeSubmission(input: {
  token: string;
  ownerId: string;
  propertyId: string | null;
  fullName: string;
  phone?: string;
  email?: string;
  files: { key: string; title: string }[];
}) {
  const [tenant] = await db
    .insert(schema.tenants)
    .values({
      ownerId: input.ownerId,
      fullName: input.fullName,
      phone: input.phone || undefined,
      email: input.email || undefined,
      kycStatus: input.files.length > 0 ? "submitted" : "pending",
      notes: "Self-registered via intake link",
    })
    .returning({ id: schema.tenants.id });

  for (const f of input.files) {
    await db.insert(schema.documents).values({
      ownerId: input.ownerId,
      propertyId: input.propertyId ?? undefined,
      docType: "kyc",
      title: f.title,
      storagePath: f.key,
    });
  }

  await db
    .update(schema.intakeLinks)
    .set({ status: "submitted", tenantId: tenant.id, submittedAt: new Date() })
    .where(eq(schema.intakeLinks.id, input.token));

  return { ok: true };
}
