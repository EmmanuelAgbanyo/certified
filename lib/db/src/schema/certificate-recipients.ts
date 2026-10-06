import { createInsertSchema } from "drizzle-zod";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { certificateBatchesTable } from "./certificate-batches";

export const certificateRecipientsTable = pgTable(
  "certificate_recipients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => certificateBatchesTable.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("certificate_recipients_batch_name_unique").on(
      table.batchId,
      table.normalizedName,
    ),
    index("certificate_recipients_normalized_name_idx").on(table.normalizedName),
  ],
);

export const insertCertificateRecipientSchema = createInsertSchema(
  certificateRecipientsTable,
).omit({
  id: true,
  createdAt: true,
});
export type InsertCertificateRecipient = z.infer<typeof insertCertificateRecipientSchema>;
export type CertificateRecipient = typeof certificateRecipientsTable.$inferSelect;
