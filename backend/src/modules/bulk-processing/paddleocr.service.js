/**
 * PaddleOCR Layout-Parsing API integration service.
 *
 * Uses the PaddleOCR layout-parsing endpoint (synchronous, no polling).
 *
 * Env vars:
 *   PADDLEOCR_API_URL  - e.g. https://3eifxay250l2y547.aistudio-app.com/layout-parsing
 *   PADDLEOCR_TOKEN    - token from aistudio
 */

const { createHttpError } = require('../../utils/httpError');

function getConfig() {
  const apiUrl = (process.env.PADDLEOCR_API_URL || '').trim();
  const token = (process.env.PADDLEOCR_TOKEN || '').trim();

  if (!apiUrl) throw createHttpError(503, 'PADDLEOCR_API_URL is not configured');
  if (!token) throw createHttpError(503, 'PADDLEOCR_TOKEN is not configured');

  return { apiUrl, token };
}

/**
 * Determine fileType: 0 = PDF, 1 = image
 */
function resolveFileType(mimeType) {
  return mimeType === 'application/pdf' ? 0 : 1;
}

/**
 * Submit a single image/PDF to PaddleOCR layout-parsing (synchronous).
 * @param {{ base64Data: string, mimeType: string, filename?: string }} input
 * @returns {{ text: string, confidence: number, raw: object }}
 */
async function ocrSingleImage({ base64Data, mimeType, filename }) {
  const { apiUrl, token } = getConfig();

  const payload = {
    file: base64Data,
    fileType: resolveFileType(mimeType),
    useDocOrientationClassify: false,
    useDocUnwarping: false,
    useChartRecognition: false,
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `token ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw createHttpError(502, `PaddleOCR request failed (${response.status})`, { detail: errText.slice(0, 500) });
  }

  const data = await response.json();
  const result = data.result;

  if (!result || !result.layoutParsingResults) {
    throw createHttpError(502, 'PaddleOCR returned unexpected format', { raw: JSON.stringify(data).slice(0, 1000) });
  }

  // Combine markdown text from all pages/results
  const texts = result.layoutParsingResults.map((r) => r.markdown?.text || '');
  const fullText = texts.join('\n\n');

  return {
    text: fullText,
    confidence: fullText.length > 0 ? 0.9 : 0,
    raw: result,
  };
}

/**
 * Process multiple images in parallel (limited concurrency).
 */
async function ocrBatch(images, opts = {}) {
  const concurrency = opts.concurrency || 3;
  const results = new Array(images.length);
  let index = 0;

  async function worker() {
    while (index < images.length) {
      const i = index;
      index += 1;
      try {
        const result = await ocrSingleImage(images[i]);
        results[i] = { pageId: images[i].pageId || null, ...result, error: null };
      } catch (error) {
        results[i] = {
          pageId: images[i].pageId || null,
          text: '',
          confidence: 0,
          raw: null,
          error: error.message || String(error),
        };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, images.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

module.exports = {
  ocrSingleImage,
  ocrBatch,
};
