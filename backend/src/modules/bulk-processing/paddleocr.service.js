/**
 * PaddleOCR API integration service.
 *
 * Uses the PaddleOCR cloud API at aistudio.baidu.com.
 * Async job-based: POST to create job, poll GET for result.
 *
 * Env vars:
 *   PADDLEOCR_API_URL  - API endpoint (default: https://paddleocr.aistudio-app.com/api/v2/ocr/jobs)
 *   PADDLEOCR_TOKEN    - Bearer token from aistudio.baidu.com/paddleocr/task
 */

const { createHttpError } = require('../../utils/httpError');

const DEFAULT_API_URL = 'https://paddleocr.aistudio-app.com/api/v2/ocr/jobs';
const DEFAULT_MODEL = 'PP-OCRv5';
const MAX_POLL_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 5000;

function getConfig() {
  const apiUrl = (process.env.PADDLEOCR_API_URL || DEFAULT_API_URL).trim();
  const token = (process.env.PADDLEOCR_TOKEN || '').trim();
  const model = (process.env.PADDLEOCR_MODEL || DEFAULT_MODEL).trim();

  if (!token) {
    throw createHttpError(503, 'PADDLEOCR_TOKEN is not configured. Get token from https://aistudio.baidu.com/paddleocr/task');
  }

  return { apiUrl, token, model };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Submit a single image to PaddleOCR and wait for result.
 * @param {{ base64Data: string, mimeType: string, filename?: string }} input
 * @returns {{ text: string, confidence: number, raw: object }}
 */
async function ocrSingleImage({ base64Data, mimeType, filename }) {
  const { apiUrl, token, model } = getConfig();

  // Build multipart form data (PaddleOCR API requires 'file' + 'model')
  const buffer = Buffer.from(base64Data, 'base64');
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('pdf') ? 'pdf' : 'jpg';
  const fname = filename || `page.${ext}`;

  const formData = new FormData();
  formData.append('file', new File([buffer], fname, { type: mimeType }));
  formData.append('model', model);

  // Step 1: Create job
  const createResponse = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!createResponse.ok) {
    const errText = await createResponse.text().catch(() => '');
    throw createHttpError(502, `PaddleOCR job creation failed (${createResponse.status})`, { detail: errText.slice(0, 500) });
  }

  const createData = await createResponse.json();
  const jobId = createData.data?.jobId || createData.jobId || createData.id;

  if (!jobId) {
    throw createHttpError(502, 'PaddleOCR returned no job ID', { raw: JSON.stringify(createData).slice(0, 1000) });
  }

  // Step 2: Poll for result
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);

    const pollResponse = await fetch(`${apiUrl}/${jobId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!pollResponse.ok) {
      if (pollResponse.status === 404) continue;
      const errText = await pollResponse.text().catch(() => '');
      throw createHttpError(502, `PaddleOCR poll failed (${pollResponse.status})`, { detail: errText.slice(0, 500) });
    }

    const pollData = await pollResponse.json();
    const state = pollData.data?.state || pollData.state;

    if (state === 'done') {
      // Result is in a JSONL URL — fetch and parse
      const resultUrl = pollData.data?.resultUrl?.jsonUrl;
      if (resultUrl) {
        return await fetchAndParseResult(resultUrl, model);
      }
      // Fallback: inline result
      return normalizeInlineResult(pollData.data || pollData);
    }

    if (state === 'failed') {
      const errorMsg = pollData.data?.errorMsg || pollData.error || 'Unknown';
      throw createHttpError(502, `PaddleOCR job failed: ${errorMsg}`);
    }
    // else: pending/running, continue polling
  }

  throw createHttpError(504, 'PaddleOCR job timed out after polling');
}

/**
 * Fetch JSONL result URL and extract text.
 */
async function fetchAndParseResult(jsonlUrl, model) {
  const response = await fetch(jsonlUrl);
  if (!response.ok) {
    throw createHttpError(502, `Failed to fetch PaddleOCR result (${response.status})`);
  }

  const text = await response.text();
  const lines = text.trim().split('\n').filter(Boolean);

  const allTexts = [];
  let totalConfidence = 0;
  let count = 0;

  for (const line of lines) {
    const parsed = JSON.parse(line);
    const result = parsed.result;

    if (result?.ocrResults) {
      // PP-OCRv5 format: ocrResults[].prunedResult.rec_texts / rec_scores
      for (const page of result.ocrResults) {
        const pruned = page.prunedResult || page;
        const texts = pruned.rec_texts || pruned.texts || [];
        const scores = pruned.rec_scores || pruned.scores || [];
        allTexts.push(...texts);
        if (scores.length) {
          totalConfidence += scores.reduce((a, b) => a + b, 0);
          count += scores.length;
        }
      }
    } else if (result?.layoutParsingResults) {
      // PaddleOCR-VL / PP-StructureV3 format
      for (const page of result.layoutParsingResults) {
        if (page.markdown?.text) {
          allTexts.push(page.markdown.text);
          count += 1;
          totalConfidence += 0.9;
        }
      }
    }
  }

  return {
    text: allTexts.join('\n'),
    confidence: count > 0 ? totalConfidence / count : 0.5,
    raw: { jsonlUrl, lineCount: lines.length },
  };
}

/**
 * Process multiple images in parallel (limited concurrency).
 * @param {Array<{ base64Data: string, mimeType: string, filename?: string, pageId?: string }>} images
 * @param {{ concurrency?: number }} opts
 * @returns {Array<{ pageId: string, text: string, confidence: number, raw: object, error?: string }>}
 */
async function ocrBatch(images, opts = {}) {
  const concurrency = opts.concurrency || 5;
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

/**
 * Normalize various PaddleOCR response formats into a unified result.
 */
function normalizeInlineResult(data) {
  // Format 1: { texts: [...], scores: [...] }
  if (Array.isArray(data.texts)) {
    const texts = data.texts || [];
    const scores = data.scores || [];
    const avgConf = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return {
      text: texts.join('\n'),
      confidence: avgConf,
      raw: data,
    };
  }

  // Format 2: { ocrResults: [{ text, score, position }] }
  if (Array.isArray(data.ocrResults)) {
    const lines = data.ocrResults.map((r) => r.text || r.content || '');
    const scores = data.ocrResults.map((r) => r.score || r.confidence || 0);
    const avgConf = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return {
      text: lines.join('\n'),
      confidence: avgConf,
      raw: data,
    };
  }

  // Format 3: { rec_texts: [...], rec_scores: [...] } (PP-OCRv4 style)
  if (Array.isArray(data.rec_texts)) {
    const texts = data.rec_texts;
    const scores = data.rec_scores || [];
    const avgConf = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return {
      text: texts.join('\n'),
      confidence: avgConf,
      raw: data,
    };
  }

  // Format 4: markdown/text content (PaddleOCR-VL style)
  if (typeof data.markdown === 'string' || typeof data.text === 'string' || typeof data.content === 'string') {
    return {
      text: data.markdown || data.text || data.content || '',
      confidence: data.confidence || data.score || 0.8,
      raw: data,
    };
  }

  // Fallback: stringify
  return {
    text: typeof data === 'string' ? data : JSON.stringify(data),
    confidence: 0.5,
    raw: data,
  };
}

module.exports = {
  ocrSingleImage,
  ocrBatch,
};
