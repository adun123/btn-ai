/**
 * PaddleOCR Async API integration service.
 *
 * Uses the PaddleOCR aistudio async API:
 *   1. Submit job (multipart/form-data with model name)
 *   2. Poll until state === 'done'
 *   3. Fetch result JSON from resultUrl
 *
 * Env vars:
 *   PADDLEOCR_API_URL  - e.g. https://paddleocr.aistudio-app.com/api/v2/ocr/jobs
 *   PADDLEOCR_TOKEN    - bearer token from aistudio
 *   PADDLEOCR_MODEL    - model name (default: PP-StructureV3)
 */

const { createHttpError } = require('../../utils/httpError');

const MAX_POLL_ATTEMPTS = 150; // 150 × 2s = 5 minutes
const POLL_INTERVAL_MS = 2000;

function getConfig() {
  const apiUrl = (process.env.PADDLEOCR_API_URL || '').trim();
  const token = (process.env.PADDLEOCR_TOKEN || '').trim();
  const model = (process.env.PADDLEOCR_MODEL || 'PP-StructureV3').trim();

  if (!apiUrl) throw createHttpError(503, 'PADDLEOCR_API_URL is not configured');
  if (!token) throw createHttpError(503, 'PADDLEOCR_TOKEN is not configured');

  return { apiUrl, token, model };
}

/**
 * Submit a single page (PDF or image) to PaddleOCR async API.
 * Returns the jobId for polling.
 */
async function submitOcrJob(base64Data, mimeType) {
  const { apiUrl, token, model } = getConfig();

  const binary = Buffer.from(base64Data, 'base64');
  const blob = new Blob([binary], { type: mimeType });

  const ext = mimeType === 'application/pdf' ? 'pdf' : 'png';
  const formData = new FormData();
  formData.append('file', blob, `page.${ext}`);
  formData.append('model', model);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { Authorization: `bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw createHttpError(502, `PaddleOCR submit failed (${response.status})`, { detail: errText.slice(0, 500) });
  }

  const data = await response.json();

  if (data.code !== 0 || !data.data?.jobId) {
    throw createHttpError(502, `PaddleOCR submit error: ${data.msg || 'unknown'}`, { raw: JSON.stringify(data).slice(0, 500) });
  }

  return data.data.jobId;
}

/**
 * Poll for job completion and fetch the result JSON.
 */
async function pollForResult(jobId) {
  const { apiUrl, token } = getConfig();
  const pollUrl = `${apiUrl}/${jobId}`;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const response = await fetch(pollUrl, {
      headers: { Authorization: `bearer ${token}` },
    });

    if (!response.ok) {
      console.warn(`[PaddleOCR] Poll ${attempt + 1} failed: HTTP ${response.status}`);
      continue;
    }

    const data = await response.json();
    const state = data.data?.state;

    // Log progress every 10 attempts
    if (attempt > 0 && attempt % 10 === 0) {
      console.log(`[PaddleOCR] Job ${jobId} poll ${attempt}/${MAX_POLL_ATTEMPTS}: state=${state}`);
    }

    if (state === 'done') {
      const jsonUrl = data.data?.resultUrl?.jsonUrl;
      if (!jsonUrl) {
        throw createHttpError(502, 'PaddleOCR job completed but no result URL');
      }
      return fetchResultJson(jsonUrl);
    }

    if (state === 'failed') {
      throw createHttpError(502, 'PaddleOCR processing failed', {
        jobId,
        raw: JSON.stringify(data).slice(0, 500),
      });
    }

    // Still running — continue polling
  }

  throw createHttpError(504, `PaddleOCR job ${jobId} timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
}

/**
 * Fetch the OCR result JSON from the signed URL.
 */
async function fetchResultJson(jsonUrl) {
  const response = await fetch(jsonUrl);
  if (!response.ok) {
    throw createHttpError(502, `Failed to fetch PaddleOCR result: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Extract readable text from PaddleOCR layout parsing results.
 */
function extractTextFromResult(resultJson) {
  const result = resultJson.result;
  if (!result || !result.layoutParsingResults) {
    return { text: '', confidence: 0, raw: resultJson };
  }

  const textBlocks = [];
  for (const page of result.layoutParsingResults) {
    const parsingList = page.prunedResult?.parsing_res_list || [];
    for (const block of parsingList) {
      // Skip image blocks
      if (block.block_label === 'image') continue;
      const content = (block.block_content || '').trim();
      if (content) {
        textBlocks.push(content);
      }
    }
  }

  const fullText = textBlocks.join('\n');
  return {
    text: fullText,
    confidence: fullText.length > 0 ? 0.9 : 0,
    raw: result,
  };
}

/**
 * Submit a single image/PDF to PaddleOCR and wait for result.
 * @param {{ base64Data: string, mimeType: string, filename?: string }} input
 * @returns {{ text: string, confidence: number, raw: object }}
 */
async function ocrSingleImage({ base64Data, mimeType, filename }) {
  const jobId = await submitOcrJob(base64Data, mimeType);
  console.log(`[PaddleOCR] Job submitted: ${jobId} (${filename || 'unknown'})`);

  const resultJson = await pollForResult(jobId);
  const extracted = extractTextFromResult(resultJson);
  console.log(`[PaddleOCR] Job ${jobId} done: ${extracted.text.length} chars`);

  return extracted;
}

/**
 * Process multiple images in parallel (limited concurrency).
 */
async function ocrBatch(images, opts = {}) {
  const concurrency = opts.concurrency || 2;
  const onProgress = opts.onProgress || null;
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
        console.error(`[PaddleOCR] Page ${i + 1} failed:`, error.message);
        results[i] = {
          pageId: images[i].pageId || null,
          text: '',
          confidence: 0,
          raw: null,
          error: error.message || String(error),
        };
      }
      if (onProgress) {
        await onProgress(results[i]).catch(err => console.error('[OCR Progress Error]', err.message));
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
