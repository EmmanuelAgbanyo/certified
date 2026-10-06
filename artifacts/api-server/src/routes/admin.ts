import {
  CreateBatchBody,
  CreateBatchResponse,
  CreateInstitutionBody,
  CreateInstitutionResponse,
  GetAdminOverviewResponse,
  ListBatchRecipientsParams,
  ListBatchRecipientsResponse,
  ListBatchesResponse,
  ListInstitutionsResponse,
} from "@workspace/api-zod";
import {
  certificateBatchesTable,
  certificateDownloadsTable,
  certificateRecipientsTable,
  db,
  institutionsTable,
} from "@workspace/db";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

function normalizeName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

async function readBatches() {
  const rows = await db
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
    .groupBy(certificateBatchesTable.id, institutionsTable.name)
    .orderBy(desc(certificateBatchesTable.createdAt));

  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

router.get("/institutions", async (_req, res): Promise<void> => {
  const rows = await db
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
    .groupBy(institutionsTable.id)
    .orderBy(institutionsTable.name);

  const institutions = rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
  res.json(ListInstitutionsResponse.parse(institutions));
});

router.post(
  "/institutions",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = CreateInstitutionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Enter an institution name." });
      return;
    }

    const name = parsed.data.name.trim().replace(/\s+/g, " ");
    const [existing] = await db
      .select({ id: institutionsTable.id })
      .from(institutionsTable)
      .where(ilike(institutionsTable.name, name))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "That institution already exists." });
      return;
    }

    const [institution] = await db
      .insert(institutionsTable)
      .values({ name })
      .returning();
    const response = {
      ...institution,
      batchCount: 0,
      createdAt: institution.createdAt.toISOString(),
    };
    res.status(201).json(CreateInstitutionResponse.parse(response));
  },
);

router.get("/admin/overview", requireAdmin, async (_req, res): Promise<void> => {
  const [[institutionTotal], [batchTotal], [recipientTotal], [downloadTotal], batches] =
    await Promise.all([
      db.select({ value: count() }).from(institutionsTable),
      db.select({ value: count() }).from(certificateBatchesTable),
      db.select({ value: count() }).from(certificateRecipientsTable),
      db.select({ value: count() }).from(certificateDownloadsTable),
      readBatches(),
    ]);

  res.json(
    GetAdminOverviewResponse.parse({
      institutionCount: institutionTotal?.value ?? 0,
      batchCount: batchTotal?.value ?? 0,
      recipientCount: recipientTotal?.value ?? 0,
      downloadCount: downloadTotal?.value ?? 0,
      recentBatches: batches.slice(0, 5),
    }),
  );
});

router.get("/batches", requireAdmin, async (_req, res): Promise<void> => {
  res.json(ListBatchesResponse.parse(await readBatches()));
});

router.post("/batches", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateBatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the batch, template, and recipient details." });
    return;
  }

  const input = parsed.data;
  if (!input.templatePath.startsWith("/objects/uploads/")) {
    res.status(400).json({ error: "Choose a template uploaded through this portal." });
    return;
  }

  const cleanedNames = Array.from(
    new Map(
      input.recipients
        .map((name) => name.normalize("NFKC").trim().replace(/\s+/g, " "))
        .filter((name) => name.length >= 2)
        .map((name) => [normalizeName(name), name]),
    ).values(),
  );
  if (cleanedNames.length === 0) {
    res.status(400).json({ error: "Add at least one recipient name." });
    return;
  }

  const [institution] = await db
    .select({ id: institutionsTable.id, name: institutionsTable.name })
    .from(institutionsTable)
    .where(eq(institutionsTable.id, input.institutionId))
    .limit(1);
  if (!institution) {
    res.status(400).json({ error: "Choose an existing institution." });
    return;
  }

  const batch = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(certificateBatchesTable)
      .values({
        institutionId: input.institutionId,
        title: input.title.trim(),
        templatePath: input.templatePath,
        templateFilename: input.templateFilename,
        templateContentType: input.templateContentType,
      })
      .returning();

    await tx.insert(certificateRecipientsTable).values(
      cleanedNames.map((fullName) => ({
        batchId: created.id,
        fullName,
        normalizedName: normalizeName(fullName),
      })),
    );
    return created;
  });

  const response = {
    id: batch.id,
    institutionId: batch.institutionId,
    institutionName: institution.name,
    title: batch.title,
    templateFilename: batch.templateFilename,
    templateContentType: batch.templateContentType,
    recipientCount: cleanedNames.length,
    createdAt: batch.createdAt.toISOString(),
  };
  res.status(201).json(CreateBatchResponse.parse(response));
});

router.get(
  "/batches/:batchId/recipients",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ListBatchRecipientsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid batch ID." });
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

    const recipients = await db
      .select({
        id: certificateRecipientsTable.id,
        fullName: certificateRecipientsTable.fullName,
      })
      .from(certificateRecipientsTable)
      .where(and(eq(certificateRecipientsTable.batchId, batch.id)))
      .orderBy(certificateRecipientsTable.fullName);
    res.json(ListBatchRecipientsResponse.parse(recipients));
  },
);

export default router;
