import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { institutionsTable } from "./institutions";

export const certificateBatchesTable = pgTable("certificate_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutionsTable.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  templatePath: text("template_path").notNull(),
  templateFilename: text("template_filename").notNull(),
  templateContentType: text("template_content_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCertificateBatchSchema = createInsertSchema(certificateBatchesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCertificateBatch = z.infer<typeof insertCertificateBatchSchema>;
export type CertificateBatch = typeof certificateBatchesTable.$inferSelect;
