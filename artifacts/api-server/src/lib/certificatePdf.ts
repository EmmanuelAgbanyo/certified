import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";

export async function createCertificatePdf(
  template: Buffer,
  contentType: string,
  recipientName: string,
): Promise<Uint8Array> {
  const pdf =
    contentType === "application/pdf"
      ? await PDFDocument.load(template, { ignoreEncryption: true })
      : await createPdfFromImage(template, contentType);

  const page = pdf.getPages()[0];
  if (!page) {
    throw new Error("The template does not contain a page.");
  }

  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  let fontSize = Math.min(36, height * 0.06);
  const maxTextWidth = width * 0.78;
  while (fontSize > 12 && font.widthOfTextAtSize(recipientName, fontSize) > maxTextWidth) {
    fontSize -= 1;
  }

  const textWidth = font.widthOfTextAtSize(recipientName, fontSize);
  page.drawText(recipientName, {
    x: (width - textWidth) / 2,
    y: height * 0.42,
    size: fontSize,
    font,
    color: rgb(0.12, 0.18, 0.24),
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
