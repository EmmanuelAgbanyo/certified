import {
  AddBatchRecipientsBody,
  AddBatchRecipientsParams,
  AddBatchRecipientsResponse,
  DeleteBatchRecipientParams,
  DeleteBatchRecipientResponse,
  DeleteCertificateBatchParams,
  DeleteCertificateBatchResponse,
  DeleteInstitutionParams,
  DeleteInstitutionResponse,
  GetCertificateNameStyleResponse,
  UpdateBatchRecipientBody,
  UpdateBatchRecipientParams,
  UpdateBatchRecipientResponse,
  UpdateCertificateBatchBody,
  UpdateCertificateBatchParams,
  UpdateCertificateBatchResponse,
  UpdateCertificateNameStyleBody,
  UpdateCertificateNameStyleResponse,
  UpdateInstitutionBody,
  UpdateInstitutionParams,
  UpdateInstitutionResponse,
} from "@workspace/api-zod";
import {
  certificateBatchesTable,
  certificateDownloadsTable,
  certificateNameStyleTable,
  certificateRecipientsTable,
  db,
  institutionsTable,
} from "@workspace/db";
import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { requireAdmin } from "../middlewares/requireAdmin";
import { ObjectStorageService } from "../lib/objectStorage";
import {
  certificateFontFamilies,
  getSavedCertificateNameStyle,
} from "../lib/certificateNameStyle";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

function normalizeName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

async function getInstitutionWithCounts(institutionId: string) {
  const [row] = await db
    .select({
      id: institutionsTable.id,
      name: institutionsTable.name,
      createdAt: institutionsTable.createdAt,
      batchCount: count(certificateBatchesTable.id),
    })
    .from(institutionsTable)
    .leftJoin(
      certificateBatchesTable,
      eq(certificateBatchesTable.institutionId, institutionsTable.id),
    )
    .where(eq(institutionsTable.id, institutionId))
    .groupBy(institutionsTable.id)
    .limit(1);

  return row
    ? { ...row, createdAt: row.createdAt.toISOString() }
    : null;
}

async function getBatchWithCounts(batchId: string) {
  const [row] = await db
    .select({
      id: certificateBatchesTable.id,
      institutionId: certificateBatchesTable.institutionId,
      institutionName: institutionsTable.name,
      title: certificateBatchesTable.title,
      templateFilename: certificateBatchesTable.templateFilename,
      templateContentType: certificateBatchesTable.templateContentType,
      createdAt: certificateBatchesTable.createdAt,
      recipientCount: count(certificateRecipientsTable.id),
    })
    .from(certificateBatchesTable)
    .innerJoin(
      institutionsTable,
      eq(certificateBatchesTable.institutionId, institutionsTable.id),
    )
    .leftJoin(
      certificateRecipientsTable,
      eq(certificateRecipientsTable.batchId, certificateBatchesTable.id),
    )
    .where(eq(certificateBatchesTable.id, batchId))
    .groupBy(certificateBatchesTable.id, institutionsTable.name)
    .limit(1);

  return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
}

async function cleanTemplateFiles(
  templatePaths: string[],
  req: Request,
): Promise<boolean> {
  let cleanupPending = false;
  for (const templatePath of new Set(templatePaths)) {
    try {
      await objectStorageService.deleteObjectEntityFile(templatePath);
    } catch (error) {
      cleanupPending = true;
      req.log.error({ err: error }, "Unable to remove a deleted certificate template");
    }
  }
  return cleanupPending;
}

router.patch(
  "/institutions/:institutionId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateInstitutionParams.safeParse(req.params);
    const parsed = UpdateInstitutionBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Enter a valid institution name." });
      return;
    }

    const name = parsed.data.name.trim().replace(/\s+/g, " ");
    if (name.length < 2) {
      res.status(400).json({ error: "Enter at least two characters for the institution name." });
      return;
    }

    const [duplicate] = await db
      .select({ id: institutionsTable.id })
      .from(institutionsTable)
      .where(
        and(
          ne(institutionsTable.id, params.data.institutionId),
          sql`lower(${institutionsTable.name}) = lower(${name})`,
        ),
      )
      .limit(1);
    if (duplicate) {
      res.status(409).json({ error: "That institution already exists." });
      return;
    }

    const [updated] = await db
      .update(institutionsTable)
      .set({ name })
      .where(eq(institutionsTable.id, params.data.institutionId))
      .returning({ id: institutionsTable.id });
    if (!updated) {
      res.status(404).json({ error: "Institution not found." });
      return;
    }

    const institution = await getInstitutionWithCounts(updated.id);
    if (!institution) {
      res.status(404).json({ error: "Institution not found." });
      return;
    }
    res.json(UpdateInstitutionResponse.parse(institution));
  },
);

router.delete(
  "/institutions/:institutionId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = DeleteInstitutionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid institution ID." });
      return;
    }

    const [institution] = await db
      .select({ id: institutionsTable.id })
      .from(institutionsTable)
      .where(eq(institutionsTable.id, params.data.institutionId))
      .limit(1);
    if (!institution) {
      res.status(404).json({ error: "Institution not found." });
      return;
    }

    const batches = await db
      .select({
        id: certificateBatchesTable.id,
        templatePath: certificateBatchesTable.templatePath,
      })
      .from(certificateBatchesTable)
      .where(eq(certificateBatchesTable.institutionId, institution.id));
    const batchIds = batches.map((batch) => batch.id);
    const [recipientCount] = batchIds.length
      ? await db
          .select({ value: count() })
          .from(certificateRecipientsTable)
          .where(inArray(certificateRecipientsTable.batchId, batchIds))
      : [undefined];

    await db.transaction(async (tx) => {
      if (batchIds.length) {
        await tx
          .delete(certificateBatchesTable)
          .where(inArray(certificateBatchesTable.id, batchIds));
      }
      await tx
        .delete(institutionsTable)
        .where(eq(institutionsTable.id, institution.id));
    });

    const storageCleanupPending = await cleanTemplateFiles(
      batches.map((batch) => batch.templatePath),
      req,
    );
    res.json(
      DeleteInstitutionResponse.parse({
        deletedBatchCount: batchIds.length,
        deletedRecipientCount: recipientCount?.value ?? 0,
        storageCleanupPending,
      }),
    );
  },
);

router.patch(
  "/batches/:batchId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateCertificateBatchParams.safeParse(req.params);
    const parsed = UpdateCertificateBatchBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Enter a valid batch title and institution." });
      return;
    }

    const title = parsed.data.title.trim();
    if (title.length < 2) {
      res.status(400).json({ error: "Enter at least two characters for the batch title." });
      return;
    }
    const [institution] = await db
      .select({ id: institutionsTable.id })
      .from(institutionsTable)
      .where(eq(institutionsTable.id, parsed.data.institutionId))
      .limit(1);
    if (!institution) {
      res.status(404).json({ error: "Institution not found." });
      return;
    }

    const [updated] = await db
      .update(certificateBatchesTable)
      .set({ institutionId: institution.id, title })
      .where(eq(certificateBatchesTable.id, params.data.batchId))
      .returning({ id: certificateBatchesTable.id });
    if (!updated) {
      res.status(404).json({ error: "Batch not found." });
      return;
    }

    const batch = await getBatchWithCounts(updated.id);
    if (!batch) {
      res.status(404).json({ error: "Batch not found." });
      return;
    }
    res.json(UpdateCertificateBatchResponse.parse(batch));
  },
);

router.delete(
  "/batches/:batchId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = DeleteCertificateBatchParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid batch ID." });
      return;
    }

    const [batch] = await db
      .select({
        id: certificateBatchesTable.id,
        templatePath: certificateBatchesTable.templatePath,
      })
      .from(certificateBatchesTable)
      .where(eq(certificateBatchesTable.id, params.data.batchId))
      .limit(1);
    if (!batch) {
      res.status(404).json({ error: "Batch not found." });
      return;
    }

    const [recipientCount] = await db
      .select({ value: count() })
      .from(certificateRecipientsTable)
      .where(eq(certificateRecipientsTable.batchId, batch.id));
    await db
      .delete(certificateBatchesTable)
      .where(eq(certificateBatchesTable.id, batch.id));

    const storageCleanupPending = await cleanTemplateFiles([batch.templatePath], req);
    res.json(
      DeleteCertificateBatchResponse.parse({
        deletedRecipientCount: recipientCount?.value ?? 0,
        storageCleanupPending,
      }),
    );
  },
);

router.post(
  "/batches/:batchId/recipients",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = AddBatchRecipientsParams.safeParse(req.params);
    const parsed = AddBatchRecipientsBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Add one or more valid full recipient names." });
      return;
    }

    const [batch] = await db
      .select({ id: certificateBatchesTable.id })
      .from(certificateBatchesTable)
      .where(eq(certificateBatchesTable.id, params.data.batchId))
      .limit(1);
    if (!batch) {
      res.status(404).json({ error: "Batch not found." });
      return;
    }

    const uniqueNames = Array.from(
      new Map(
        parsed.data.recipients
          .map((name) => name.normalize("NFKC").trim().replace(/\s+/g, " "))
          .filter((name) => name.length >= 2)
          .map((name) => [normalizeName(name), name]),
      ),
      ([, name]) => name,
    );
    if (!uniqueNames.length) {
      res.status(400).json({ error: "Add at least one valid full recipient name." });
      return;
    }

    const existingNames = await db
      .select({ normalizedName: certificateRecipientsTable.normalizedName })
      .from(certificateRecipientsTable)
      .where(eq(certificateRecipientsTable.batchId, batch.id));
    const existing = new Set(existingNames.map((row) => row.normalizedName));
    const newNames = uniqueNames.filter((name) => !existing.has(normalizeName(name)));
    const [currentCount] = await db
      .select({ value: count() })
      .from(certificateRecipientsTable)
      .where(eq(certificateRecipientsTable.batchId, batch.id));
    if ((currentCount?.value ?? 0) + newNames.length > 5000) {
      res.status(409).json({ error: "A batch can contain no more than 5,000 recipients." });
      return;
    }

    if (newNames.length) {
      const inserted = await db
        .insert(certificateRecipientsTable)
        .values(
          newNames.map((fullName) => ({
            batchId: batch.id,
            fullName,
            normalizedName: normalizeName(fullName),
          })),
        )
        .onConflictDoNothing()
        .returning({ id: certificateRecipientsTable.id });
      const added = inserted.length;
      res.json(
        AddBatchRecipientsResponse.parse({
          added,
          skipped: parsed.data.recipients.length - added,
        }),
      );
      return;
    }
    res.json(
      AddBatchRecipientsResponse.parse({
        added: 0,
        skipped: parsed.data.recipients.length,
      }),
    );
  },
);

router.patch(
  "/batches/:batchId/recipients/:recipientId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateBatchRecipientParams.safeParse(req.params);
    const parsed = UpdateBatchRecipientBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Enter a valid recipient name." });
      return;
    }

    const fullName = parsed.data.fullName.trim().replace(/\s+/g, " ");
    if (fullName.length < 2) {
      res.status(400).json({ error: "Enter at least two characters for the recipient name." });
      return;
    }
    const normalizedName = normalizeName(fullName);
    const [recipient] = await db
      .select({ id: certificateRecipientsTable.id })
      .from(certificateRecipientsTable)
      .where(
        and(
          eq(certificateRecipientsTable.id, params.data.recipientId),
          eq(certificateRecipientsTable.batchId, params.data.batchId),
        ),
      )
      .limit(1);
    if (!recipient) {
      res.status(404).json({ error: "Recipient not found in this batch." });
      return;
    }

    const [duplicate] = await db
      .select({ id: certificateRecipientsTable.id })
      .from(certificateRecipientsTable)
      .where(
        and(
          eq(certificateRecipientsTable.batchId, params.data.batchId),
          eq(certificateRecipientsTable.normalizedName, normalizedName),
          ne(certificateRecipientsTable.id, recipient.id),
        ),
      )
      .limit(1);
    if (duplicate) {
      res.status(409).json({ error: "A recipient with that name already exists in this batch." });
      return;
    }

    const [updated] = await db
      .update(certificateRecipientsTable)
      .set({ fullName, normalizedName })
      .where(eq(certificateRecipientsTable.id, recipient.id))
      .returning({
        id: certificateRecipientsTable.id,
        fullName: certificateRecipientsTable.fullName,
      });
    if (!updated) {
      res.status(404).json({ error: "Recipient not found in this batch." });
      return;
    }
    res.json(UpdateBatchRecipientResponse.parse(updated));
  },
);

router.delete(
  "/batches/:batchId/recipients/:recipientId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = DeleteBatchRecipientParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid recipient or batch ID." });
      return;
    }

    const [deleted] = await db
      .delete(certificateRecipientsTable)
      .where(
        and(
          eq(certificateRecipientsTable.id, params.data.recipientId),
          eq(certificateRecipientsTable.batchId, params.data.batchId),
        ),
      )
      .returning({ id: certificateRecipientsTable.id });
    if (!deleted) {
      res.status(404).json({ error: "Recipient not found in this batch." });
      return;
    }
    res.json(DeleteBatchRecipientResponse.parse({ deleted: true }));
  },
);

router.get(
  "/admin/certificate-name-style",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const style = await getSavedCertificateNameStyle();
    res.json(
      GetCertificateNameStyleResponse.parse({
        fontFamily: style.fontFamily,
        textColor: style.textColor,
        fontSize: style.fontSize,
        updatedAt: style.updatedAt.toISOString(),
      }),
    );
  },
);

router.put(
  "/admin/certificate-name-style",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = UpdateCertificateNameStyleBody.safeParse(req.body);
    if (
      !parsed.success ||
      !certificateFontFamilies.includes(
        parsed.data.fontFamily as (typeof certificateFontFamilies)[number],
      )
    ) {
      res.status(400).json({ error: "Choose a supported font, text color, and name size." });
      return;
    }

    const [style] = await db
      .insert(certificateNameStyleTable)
      .values({
        id: "global",
        fontFamily: parsed.data.fontFamily,
        textColor: parsed.data.textColor,
        fontSize: parsed.data.fontSize,
      })
      .onConflictDoUpdate({
        target: certificateNameStyleTable.id,
        set: {
          fontFamily: parsed.data.fontFamily,
          textColor: parsed.data.textColor,
          fontSize: parsed.data.fontSize,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(
      UpdateCertificateNameStyleResponse.parse({
        fontFamily: style.fontFamily,
        textColor: style.textColor,
        fontSize: style.fontSize,
        updatedAt: style.updatedAt.toISOString(),
      }),
    );
  },
);

export default router;
