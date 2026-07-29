import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { sendWorkflow } from "../temporal/runWorkflow.js";

const addPhotoBody = z.object({
  storagePath: z.string().min(1),
  caption: z.string().max(200).optional(),
});

// Owner-side photo management for a property. Uploads go straight to R2 via
// POST /storage/presign-upload (same flow as documents); this only records the
// resulting key, and the activity re-checks that the key is under the caller's
// own prefix before it will store it.
export async function propertyPhotoRoutes(app: FastifyInstance) {
  app.get("/properties/:id/photos", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return sendWorkflow(reply, "listPropertyPhotosWorkflow", [{ propertyId: id, ownerId: req.userId! }]);
  });

  app.post(
    "/properties/:id/photos",
    { preHandler: requireAuth, schema: { body: addPhotoBody } },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      return sendWorkflow(
        reply,
        "addPropertyPhotoWorkflow",
        [{ ownerId: req.userId!, propertyId: id, ...(req.body as z.infer<typeof addPhotoBody>) }],
        201,
      );
    },
  );

  // Scoped by photo id + owner, not by the property in the path — the activity
  // matches on ownerId, so the :id segment can't be used to delete someone
  // else's photo even if the property id in the URL were wrong.
  app.delete("/properties/:id/photos/:photoId", { preHandler: requireAuth }, async (req, reply) => {
    const { photoId } = req.params as { photoId: string };
    return sendWorkflow(reply, "deletePropertyPhotoWorkflow", [{ id: photoId, ownerId: req.userId! }], 204);
  });
}
