/**
 * PDF Splitter Service
 *
 * Splits PDF files into individual single-page PDFs using pdf-lib (pure JS).
 * Each page is sent to PaddleOCR as a separate PDF (fileType: 0).
 * No external tools (pdftoppm/poppler) required.
 */

const { PDFDocument } = require('pdf-lib');

/**
 * Split a PDF buffer into individual single-page PDF buffers.
 * @param {Buffer} pdfBuffer - Raw PDF file buffer
 * @param {string} filename - Original filename for reference
 * @returns {Array<{ pageNumber: number, base64Data: string, mimeType: string }>}
 */
async function splitPdfToImages(pdfBuffer, filename) {
  const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pageCount = srcDoc.getPageCount();
  const pages = [];

  for (let i = 0; i < pageCount; i += 1) {
    const newDoc = await PDFDocument.create();
    const [copiedPage] = await newDoc.copyPages(srcDoc, [i]);
    newDoc.addPage(copiedPage);
    const pdfBytes = await newDoc.save();
    pages.push({
      pageNumber: i + 1,
      base64Data: Buffer.from(pdfBytes).toString('base64'),
      mimeType: 'application/pdf',
    });
  }

  return pages;
}

/**
 * Get page count from a PDF buffer.
 * @param {Buffer} pdfBuffer
 * @returns {number}
 */
async function getPdfPageCount(pdfBuffer) {
  try {
    const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    return doc.getPageCount();
  } catch {
    return 1;
  }
}

/**
 * Process an image file (non-PDF) into the standard page format.
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {string} filename
 * @returns {Array<{ pageNumber: number, base64Data: string, mimeType: string }>}
 */
function imageToPages(imageBuffer, mimeType, filename) {
  return [{
    pageNumber: 1,
    base64Data: imageBuffer.toString('base64'),
    mimeType,
  }];
}

module.exports = {
  splitPdfToImages,
  getPdfPageCount,
  imageToPages,
};
