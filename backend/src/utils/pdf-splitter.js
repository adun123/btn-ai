const { PDFDocument } = require('pdf-lib');

/**
 * Split a PDF buffer into individual single-page PDF buffers.
 * Returns array of { pageNumber, buffer } objects.
 */
async function splitPdfPages(pdfBuffer) {
  const srcDoc = await PDFDocument.load(pdfBuffer);
  const pageCount = srcDoc.getPageCount();
  const pages = [];

  for (let i = 0; i < pageCount; i++) {
    const newDoc = await PDFDocument.create();
    const [copied] = await newDoc.copyPages(srcDoc, [i]);
    newDoc.addPage(copied);
    const bytes = await newDoc.save();
    pages.push({ pageNumber: i + 1, buffer: Buffer.from(bytes) });
  }

  return pages;
}

module.exports = { splitPdfPages };
