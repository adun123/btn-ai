/**
 * PDF Splitter Service
 *
 * Splits PDF files into individual page images (PNG/JPEG) for OCR processing.
 * Uses pdf-poppler for PDF → image conversion.
 * Falls back to returning base64 of the PDF page if conversion tools are unavailable.
 */

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { createHttpError } = require('../../utils/httpError');

const execFileAsync = promisify(execFile);

/**
 * Split a PDF buffer into page images.
 * @param {Buffer} pdfBuffer - Raw PDF file buffer
 * @param {string} filename - Original filename for reference
 * @returns {Array<{ pageNumber: number, base64Data: string, mimeType: string }>}
 */
async function splitPdfToImages(pdfBuffer, filename) {
  const tmpDir = path.join(os.tmpdir(), `bulk-ocr-${randomUUID()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  const pdfPath = path.join(tmpDir, 'input.pdf');
  await fs.writeFile(pdfPath, pdfBuffer);

  try {
    // Try pdftoppm (from poppler-utils) first
    const outputPrefix = path.join(tmpDir, 'page');
    await execFileAsync('pdftoppm', [
      '-png',
      '-r', '200', // 200 DPI - good balance between quality and size
      pdfPath,
      outputPrefix,
    ], { timeout: 60000 });

    // Read generated page images
    const files = await fs.readdir(tmpDir);
    const pageFiles = files
      .filter((f) => f.startsWith('page-') && f.endsWith('.png'))
      .sort();

    if (pageFiles.length === 0) {
      // pdftoppm may use different naming: page-1.png, page-01.png, etc.
      const altFiles = files.filter((f) => f.startsWith('page') && f.endsWith('.png')).sort();
      if (altFiles.length === 0) {
        throw new Error('pdftoppm produced no output files');
      }
      return await readPageImages(tmpDir, altFiles);
    }

    return await readPageImages(tmpDir, pageFiles);
  } catch (error) {
    // If pdftoppm is not available, try using pdf-img-convert approach
    // For MVP, we can also send the raw PDF to PaddleOCR (it supports PDF input)
    // Return the PDF as a single "page" and let PaddleOCR handle it
    const base64 = pdfBuffer.toString('base64');
    return [{
      pageNumber: 1,
      base64Data: base64,
      mimeType: 'application/pdf',
      isFullPdf: true,
      originalFilename: filename,
    }];
  } finally {
    // Cleanup temp files
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function readPageImages(dir, pageFiles) {
  const pages = [];
  for (let i = 0; i < pageFiles.length; i += 1) {
    const filePath = path.join(dir, pageFiles[i]);
    const buffer = await fs.readFile(filePath);
    pages.push({
      pageNumber: i + 1,
      base64Data: buffer.toString('base64'),
      mimeType: 'image/png',
    });
  }
  return pages;
}

/**
 * Get page count from a PDF buffer without fully rendering.
 * @param {Buffer} pdfBuffer
 * @returns {number}
 */
async function getPdfPageCount(pdfBuffer) {
  const tmpDir = path.join(os.tmpdir(), `bulk-ocr-count-${randomUUID()}`);
  await fs.mkdir(tmpDir, { recursive: true });
  const pdfPath = path.join(tmpDir, 'input.pdf');
  await fs.writeFile(pdfPath, pdfBuffer);

  try {
    const { stdout } = await execFileAsync('pdfinfo', [pdfPath], { timeout: 10000 });
    const match = stdout.match(/Pages:\s*(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  } catch {
    // Fallback: rough estimation from buffer size (1 page ~50-200KB)
    return Math.max(1, Math.round(pdfBuffer.length / 150000));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
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
    originalFilename: filename,
  }];
}

module.exports = {
  splitPdfToImages,
  getPdfPageCount,
  imageToPages,
};
