import type { FastifyInstance } from "fastify";
import { putObject } from "../plugins/r2.js";
import { runWorkflow } from "../temporal/runWorkflow.js";
import type { HttpFailure } from "../temporal/runWorkflow.js";

const MAX_FILES = 6;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "pdf", "xml", "zip"];
const TOKEN_RE = /^[0-9a-f-]{36}$/i;

// Anonymous but token-gated: no auth required, the caller must present a
// pending, unexpired intake_links uuid. Multipart draining, file-shape
// validation, and the R2 writes themselves stay here (raw bytes can't cross
// a Temporal payload boundary) — link validation and all DB writes run
// through Temporal workflows (api/src/temporal/workflows/tenantIntake.ts).
export async function tenantIntakeRoutes(app: FastifyInstance) {
  app.post("/tenant-intake/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    if (!TOKEN_RE.test(token)) return reply.code(400).send({ error: "Invalid link" });

    let fullName = "";
    let phone = "";
    let email = "";
    const files: { name: string; buffer: Buffer }[] = [];

    for await (const part of req.parts()) {
      if (part.type === "file") {
        if (files.length >= MAX_FILES) {
          return reply.code(400).send({ error: `At most ${MAX_FILES} files` });
        }
        const buffer = await part.toBuffer();
        if (buffer.length === 0) continue;
        if (buffer.length > MAX_FILE_BYTES) {
          return reply.code(400).send({ error: `${part.filename} is larger than 10 MB` });
        }
        const ext = part.filename.split(".").pop()?.toLowerCase() ?? "";
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          return reply
            .code(400)
            .send({ error: `${part.filename}: only jpg, png, webp, pdf, xml, zip files are allowed` });
        }
        files.push({ name: part.filename, buffer });
      } else {
        const value = String(part.value ?? "").trim();
        if (part.fieldname === "full_name") fullName = value;
        if (part.fieldname === "phone") phone = value;
        if (part.fieldname === "email") email = value;
      }
    }

    if (!fullName) return reply.code(400).send({ error: "Name is required" });

    let link: { ownerId: string; propertyId: string | null };
    try {
      link = await runWorkflow(
        "validateIntakeLinkForSubmissionWorkflow",
        [{ token }],
      );
    } catch (err) {
      const { status, body } = err as HttpFailure;
      return reply.code(status).send(body);
    }

    const uploaded: { key: string; title: string }[] = [];
    for (const f of files) {
      const safeName = f.name.replace(/[^\w.-]/g, "_");
      const key = `${link.ownerId}/intake/${token}/${safeName}`;
      await putObject(key, f.buffer);
      uploaded.push({ key, title: `${fullName} — ${safeName}` });
    }

    try {
      const result = await runWorkflow(
        "finalizeIntakeSubmissionWorkflow",
        [{ token, ownerId: link.ownerId, propertyId: link.propertyId, fullName, phone, email, files: uploaded }],
      );
      return reply.send(result);
    } catch (err) {
      const { status, body } = err as HttpFailure;
      return reply.code(status).send(body);
    }
  });
}
