import { createInsertSchema } from "drizzle-zod";
import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { certificateRecipientsTable } from "./certificate-recipients";

export const certificateDownloadsTable = pgTable("certificate_downloads", {
  id: uuid("id").defaultRandom().primaryKey(),
  recipientId: uuid("recipient_id")
    .notNull()
    .references(() => certificateRecipientsTable.id, { onDelete: "cascade" }),
  downloadedAt: timestamp("downloaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCertificateDownloadSchema = createInsertSchema(
  certificateDownloadsTable,
).omit({
  id: true,
  downloadedAt: true,
});
export type InsertCertificateDownload = z.infer<typeof insertCertificateDownloadSchema>;
export type CertificateDownload = typeof certificateDownloadsTable.$inferSelect;
