import { eq } from "drizzle-orm";
import { db, certificateNameStyleTable } from "@workspace/db";

export const certificateFontFamilies = [
  "helvetica",
  "helveticaBold",
  "timesRoman",
  "timesRomanBold",
  "courier",
  "courierBold",
] as const;

export type CertificateFontFamily = (typeof certificateFontFamilies)[number];

export const defaultCertificateNameStyle = {
  fontFamily: "helveticaBold",
  textColor: "#1f2e3d",
  fontSize: 36,
} as const satisfies {
  fontFamily: CertificateFontFamily;
  textColor: string;
  fontSize: number;
};

export async function getSavedCertificateNameStyle() {
  await db
    .insert(certificateNameStyleTable)
    .values({ id: "global", ...defaultCertificateNameStyle })
    .onConflictDoNothing();

  const [style] = await db
    .select()
    .from(certificateNameStyleTable)
    .where(eq(certificateNameStyleTable.id, "global"))
    .limit(1);

  if (!style) {
    throw new Error("Global certificate name style is unavailable.");
  }

  if (!certificateFontFamilies.includes(style.fontFamily as CertificateFontFamily)) {
    throw new Error("Global certificate name font is not supported.");
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(style.textColor)) {
    throw new Error("Global certificate name color is invalid.");
  }
  if (!Number.isInteger(style.fontSize) || style.fontSize < 12 || style.fontSize > 72) {
    throw new Error("Global certificate name size is invalid.");
  }

  return {
    ...style,
    fontFamily: style.fontFamily as CertificateFontFamily,
  };
}
