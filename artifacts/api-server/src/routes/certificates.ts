import {
  DownloadCertificateBody,
  DownloadCertificateParams,
  SearchCertificatesBody,
  SearchCertificatesResponse,
  VerifyCertificateBody,
  VerifyCertificateResponse,
} from "@workspace/api-zod";
import {
  certificateBatchesTable,
  certificateDownloadsTable,
  certificateRecipientsTable,
  db,
  institutionsTable,
} from "@workspace/db";
import { and, asc, eq, ilike } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { createCertificatePdf } from "../lib/certificatePdf";
import { getSavedCertificateNameStyle } from "../lib/certificateNameStyle";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const limitWindowMs = 60_000;
const limitCount = 25;
const requestsByIp = new Map<string, { count: number; resetAt: number }>();

function normalizeName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function allowRequest(req: Request): boolean {
  const key = req.ip || "unknown";
  const now = Date.now();
  const record = requestsByIp.get(key);
  if (!record || record.resetAt <= now) {
    requestsByIp.set(key, { count: 1, resetAt: now + limitWindowMs });
    if (requestsByIp.size > 1_000) {
      for (const [ip, request] of requestsByIp) {
        if (request.resetAt <= now) requestsByIp.delete(ip);
      }
    }
    return true;
  }
  if (record.count >= limitCount) return false;
  record.count += 1;
  return true;
}

router.post("/certificates/search", async (req, res): Promise<void> => {
  if (!allowRequest(req)) {
    res.status(429).json({ error: "Too many searches. Please try again in a minute." });
    return;
  }

  const parsed = SearchCertificatesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Select an institution and enter at least two characters of a name." });
    return;
  }
  const searchTerm = normalizeName(parsed.data.name);
  const escapedSearchTerm = escapeLikePattern(searchTerm);

  const rows = await db
    .select({
      id: certificateRecipientsTable.id,
      institutionName: institutionsTable.name,
      batchTitle: certificateBatchesTable.title,
      fullName: certificateRecipientsTable.fullName,
    })
    .from(certificateRecipientsTable)
    .innerJoin(
      certificateBatchesTable,
      eq(certificateRecipientsTable.batchId, certificateBatchesTable.id),
    )
    .innerJoin(
      institutionsTable,
      eq(certificateBatchesTable.institutionId, institutionsTable.id),
    )
    .where(
      and(
        eq(institutionsTable.id, parsed.data.institutionId),
        ilike(certificateRecipientsTable.normalizedName, `%${escapedSearchTerm}%`),
      ),
    )
    .orderBy(asc(certificateRecipientsTable.fullName))
    .limit(20);

  res.json(SearchCertificatesResponse.parse(rows));
});

router.post("/certificates/verify", async (req, res): Promise<void> => {
  if (!allowRequest(req)) {
    res.status(429).json({ error: "Too many verification attempts. Please try again in a minute." });
    return;
  }

  const parsed = VerifyCertificateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Select an institution and enter your full name." });
    return;
  }

  const rows = await db
    .select({
      id: certificateRecipientsTable.id,
      institutionName: institutionsTable.name,
      batchTitle: certificateBatchesTable.title,
      fullName: certificateRecipientsTable.fullName,
    })
    .from(certificateRecipientsTable)
    .innerJoin(
      certificateBatchesTable,
      eq(certificateRecipientsTable.batchId, certificateBatchesTable.id),
    )
    .innerJoin(
      institutionsTable,
      eq(certificateBatchesTable.institutionId, institutionsTable.id),
    )
    .where(
      and(
        eq(institutionsTable.id, parsed.data.institutionId),
        eq(certificateRecipientsTable.normalizedName, normalizeName(parsed.data.fullName)),
      ),
    )
    .orderBy(asc(certificateBatchesTable.title), asc(certificateRecipientsTable.fullName))
    .limit(20);

  res.json(VerifyCertificateResponse.parse(rows));
});

router.post(
  "/certificates/:recipientId/download",
  async (req, res): Promise<void> => {
    if (!allowRequest(req)) {
      res.status(429).json({ error: "Too many requests. Please try again in a minute." });
      return;
    }

    const params = DownloadCertificateParams.safeParse(req.params);
    const parsed = DownloadCertificateBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Invalid certificate request." });
      return;
    }

    const [record] = await db
      .select({
        recipientId: certificateRecipientsTable.id,
        fullName: certificateRecipientsTable.fullName,
        templatePath: certificateBatchesTable.templatePath,
        templateFilename: certificateBatchesTable.templateFilename,
        templateContentType: certificateBatchesTable.templateContentType,
      })
      .from(certificateRecipientsTable)
      .innerJoin(
        certificateBatchesTable,
        eq(certificateRecipientsTable.batchId, certificateBatchesTable.id),
      )
      .where(
        and(
          eq(certificateRecipientsTable.id, params.data.recipientId),
          eq(certificateRecipientsTable.normalizedName, normalizeName(parsed.data.fullName)),
        ),
      )
      .limit(1);

    if (!record) {
      res.status(404).json({ error: "Certificate not found for that name." });
      return;
    }

    try {
      const objectFile = await objectStorageService.getObjectEntityFile(record.templatePath);
      const [template] = await objectFile.download();
      const nameStyle = await getSavedCertificateNameStyle();
      const pdf = await createCertificatePdf(
        template,
        record.templateContentType,
        record.fullName,
        nameStyle,
      );
      await db.insert(certificateDownloadsTable).values({ recipientId: record.recipientId });

      const filename = record.fullName
        .normalize("NFKD")
        .replace(/[^\w -]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 80);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename || "certificate"}.pdf"`,
      );
      res.setHeader("Cache-Control", "private, no-store");
      res.send(Buffer.from(pdf));
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        req.log.error({ err: error }, "Certificate template is missing from storage");
        res.status(404).json({ error: "This certificate template is no longer available." });
        return;
      }
      req.log.error({ err: error }, "Unable to generate certificate PDF");
      res.status(500).json({ error: "Unable to generate this certificate right now." });
    }
  },
);

export default router;
