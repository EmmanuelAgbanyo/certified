import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const certificateNameStyleTable = pgTable("certificate_name_style", {
  id: text("id").primaryKey().default("global"),
  fontFamily: text("font_family").notNull().default("helveticaBold"),
  textColor: text("text_color").notNull().default("#1f2e3d"),
  fontSize: integer("font_size").notNull().default(36),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertCertificateNameStyleSchema = createInsertSchema(
  certificateNameStyleTable,
).omit({ id: true, updatedAt: true });
export type InsertCertificateNameStyle = z.infer<
  typeof insertCertificateNameStyleSchema
>;
export type CertificateNameStyle =
  typeof certificateNameStyleTable.$inferSelect;
