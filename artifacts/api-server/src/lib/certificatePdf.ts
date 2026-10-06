import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";
import type { CertificateFontFamily } from "./certificateNameStyle";

const pdfFonts: Record<CertificateFontFamily, StandardFonts> = {
  helvetica: StandardFonts.Helvetica,
  helveticaBold: StandardFonts.HelveticaBold,
  timesRoman: StandardFonts.TimesRoman,
  timesRomanBold: StandardFonts.TimesRomanBold,
  courier: StandardFonts.Courier,
  courierBold: StandardFonts.CourierBold,
};

export async function createCertificatePdf(
  template: Buffer,
  contentType: string,
  recipientName: string,
  nameStyle: {
    fontFamily: CertificateFontFamily;
    textColor: string;
    fontSize: number;
  },
): Promise<Uint8Array> {
  const pdf =
    contentType === "application/pdf"
      ? await PDFDocument.load(template, { ignoreEncryption: true })
      : await createPdfFromImage(template, contentType);

  const page = pdf.getPages()[0];
  if (!page) {
    throw new Error("The template does not contain a page.");
  }

  const font = await pdf.embedFont(pdfFonts[nameStyle.fontFamily]);
  const { width, height } = page.getSize();
  let fontSize = Math.min(nameStyle.fontSize, height * 0.12);
  const maxTextWidth = width * 0.78;
  while (fontSize > 12 && font.widthOfTextAtSize(recipientName, fontSize) > maxTextWidth) {
    fontSize -= 1;
  }

  const textWidth = font.widthOfTextAtSize(recipientName, fontSize);
  const hexColor = nameStyle.textColor.slice(1);
  const red = Number.parseInt(hexColor.slice(0, 2), 16) / 255;
  const green = Number.parseInt(hexColor.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(hexColor.slice(4, 6), 16) / 255;
  page.drawText(recipientName, {
    x: (width - textWidth) / 2,
    y: height * 0.42,
    size: fontSize,
    font,
    color: rgb(red, green, blue),
  });

  return pdf.save();
}

async function createPdfFromImage(
  image: Buffer,
  contentType: string,
): Promise<PDFDocument> {
  const pdf = await PDFDocument.create();
  const embedded =
    contentType === "image/png"
      ? await pdf.embedPng(image)
      : await pdf.embedJpg(image);
  const isLandscape = embedded.width >= embedded.height;
  const pageWidth = isLandscape ? 841.89 : 595.28;
  const pageHeight = isLandscape ? 595.28 : 841.89;
  const page = pdf.addPage([pageWidth, pageHeight]);
  const scale = Math.min(pageWidth / embedded.width, pageHeight / embedded.height);
  const width = embedded.width * scale;
  const height = embedded.height * scale;

  page.drawImage(embedded, {
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  });

  return pdf;
}
