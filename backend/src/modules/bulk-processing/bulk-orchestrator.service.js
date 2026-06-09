/**
 * Bulk OCR Processing Orchestrator
 *
 * Coordinates the full pipeline:
 *   1. Extract files (unzip or collect uploaded files)
 *   2. Split PDFs into pages
 *   3. Assign pages to N batches (evenly distributed)
 *   4. Run OCR on all batches in parallel
 *   5. Classify documents
 *   6. Group by nasabah
 *   7. Check completeness
 *   8. Store results
 */

const { randomUUID } = require('node:crypto');
const { createHttpError } = require('../../utils/httpError');
const repository = require('./bulk.repository');
const { splitPdfToImages, imageToPages } = require('./pdf-splitter.service');
const { ocrBatch } = require('./paddleocr.service');
const { classifyAndGroupPages } = require('./classification.service');
const { groupByNasabah, UNIDENTIFIED_FULL_NAME } = require('./grouping.service');
const { checkAllCompleteness } = require('./completeness.service');
const { evaluateAllNasabahRules } = require('./rule-evaluation.service');
const { classifyAndExtractWithAI } = require('./ai-classification.service');

const DEFAULT_BATCH_SIZE = 20;
const OCR_CONCURRENCY = 5;

/**
 * Gemini OCR fallback: extract text from an image when PaddleOCR is unavailable.
 */
async function geminiOcrFallback(base64Data, mimeType) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    generationConfig: { temperature: 0, responseMimeType: 'text/plain' },
  });

  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [
        { text: 'Extract ALL visible text from this document image. Return only the raw text, preserve the layout as much as possible. Do not add any commentary.' },
        { inlineData: { mimeType, data: base64Data } },
      ],
    }],
  });

  const text = (await result.response).text();
  return { text, confidence: text.length > 20 ? 0.85 : 0.5 };
}

/**
 * AI-based classification: sends each page's OCR text to Gemini for classification + field extraction.
 * Returns same format as classifyAndGroupPages for compatibility.
 */
async function classifyWithAI(pagesWithText) {
  const documents = [];

  // Process pages in batches of 5 to avoid rate limits
  for (let i = 0; i < pagesWithText.length; i += 5) {
    const batch = pagesWithText.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (page) => {
        const detected = await classifyAndExtractWithAI(page.ocrText);
        return detected.map((doc) => ({
          documentType: doc.documentType,
          confidence: doc.confidence,
          method: 'ai_gemini',
          sourceFilename: page.sourceFilename,
          pageIds: [page.pageId],
          extractedFields: doc.fields,
        }));
      })
    );
    for (const pageResults of results) {
      documents.push(...pageResults);
    }
  }

  return documents;
}

/**
 * Create a new bulk processing job and begin processing in background.
 * @param {{ files: Array<{ buffer: Buffer, originalname: string, mimetype: string }>, uploadType: 'zip'|'bulk_files' }} input
 * @returns {{ jobId: string, status: string }}
 */
async function createAndProcessJob(input) {
  const { files, uploadType } = input;

  if (!files || files.length === 0) {
    throw createHttpError(400, 'At least one file is required');
  }

  const jobId = randomUUID();
  const batchSize = parseInt(process.env.BULK_BATCH_SIZE, 10) || DEFAULT_BATCH_SIZE;

  // Create initial job record
  const job = await repository.createJob({
    id: jobId,
    status: 'pending',
    uploadType,
    totalFiles: files.length,
    totalPages: 0,
    processedPages: 0,
    batchCount: 0,
    batchSize,
    metadata: {
      filenames: files.map((f) => f.originalname),
    },
  });

  // Process asynchronously in background (supported since we run on a dedicated EC2 Node server, not serverless)
  processJob(jobId, files, batchSize).catch(async (error) => {
    console.error(`[BulkOCR] Job ${jobId} failed:`, error.message);
    await repository.updateJob(jobId, {
      status: 'failed',
      error: error.message || 'Unknown processing error',
      completedAt: new Date().toISOString(),
    }).catch(() => {});
  });

  return { jobId: job.id, status: job.status };
}

/**
 * Main processing pipeline (runs in background).
 */
async function processJob(jobId, files, batchSize) {
  // ─── STAGE 1: Extract & Split ───────────────────────────────────────────────
  await repository.updateJob(jobId, { status: 'extracting' });

  const allPages = []; // { sourceFilename, pageNumber, base64Data, mimeType }

  for (const file of files) {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    const isImage = file.mimetype.startsWith('image/');

    if (isPdf) {
      const pages = await splitPdfToImages(file.buffer, file.originalname);
      for (const page of pages) {
        allPages.push({
          sourceFilename: file.originalname,
          pageNumber: page.pageNumber,
          base64Data: page.base64Data,
          mimeType: page.mimeType,
        });
      }
    } else if (isImage) {
      const pages = imageToPages(file.buffer, file.mimetype, file.originalname);
      for (const page of pages) {
        allPages.push({
          sourceFilename: file.originalname,
          pageNumber: page.pageNumber,
          base64Data: page.base64Data,
          mimeType: page.mimeType,
        });
      }
    }
    // Skip non-PDF/non-image files silently
  }

  if (allPages.length === 0) {
    throw createHttpError(400, 'No processable PDF or image files found in upload');
  }

  // ─── STAGE 2: Assign pages to batches (evenly distributed) ──────────────────
  const totalPages = allPages.length;
  const batchCount = Math.ceil(totalPages / batchSize);

  // Create page records with batch assignments
  const pageRecords = allPages.map((page, index) => ({
    id: randomUUID(),
    jobId,
    sourceFilename: page.sourceFilename,
    pageNumber: page.pageNumber,
    batchIndex: index % batchCount, // Distribute evenly across batches
    status: 'pending',
  }));

  await repository.insertPages(pageRecords);
  await repository.updateJob(jobId, {
    status: 'ocr_processing',
    totalPages,
    batchCount,
  });

  // ─── STAGE 3: OCR and Classification Stream ──────────────────────────────────
  let processedCount = 0;

  async function handleProgress(result) {
    // 1. If PaddleOCR failed, try Gemini OCR as fallback
    if (result.error && process.env.GEMINI_API_KEY) {
      try {
        const pageIdx = pageRecords.findIndex((p) => p.id === result.pageId);
        if (pageIdx >= 0) {
          const page = allPages[pageIdx];
          const geminiResult = await geminiOcrFallback(page.base64Data, page.mimeType);
          result.text = geminiResult.text;
          result.confidence = geminiResult.confidence;
          result.error = null;
        }
      } catch (e) {
        console.error(`[Gemini OCR Fallback] Also failed for ${result.pageId}:`, e.message);
      }
    }

    // 2. Save OCR result only — classification happens in batch later
    await repository.updatePage(result.pageId, {
      ...(result.error ? { status: 'failed' } : {}),
      ocrText: result.text || ' ',
      ocrConfidence: result.confidence || 0,
      ocrRaw: result.raw || null,
      error: result.error || null,
    });

    // 3. Mark page completed and update progress
    await repository.updatePage(result.pageId, { status: result.error ? 'failed' : 'completed' });
    processedCount += 1;
    await repository.updateJob(jobId, { processedPages: processedCount });
  }

  // Combine all pages into a single flat array so the worker pool can process them seamlessly
  const allImages = pageRecords.map((page, i) => ({
    ...page,
    base64Data: allPages[i].base64Data,
    mimeType: allPages[i].mimeType,
  }));

  // Process ALL pages seamlessly in a single global worker pool.
  // If one page gets stuck, the other worker will pick up ALL remaining pages.
  const flatResults = await processBatch(allImages, handleProgress);

  // ─── STAGE 4: Classification (batched for speed) ────────────────────────────
  await repository.updateJob(jobId, { status: 'classifying' });

  const pagesWithText = flatResults
    .filter((r) => !r.error && r.text && r.text.trim().length > 10)
    .map((r) => {
      const record = pageRecords.find((p) => p.id === r.pageId);
      return { pageId: r.pageId, ocrText: r.text, sourceFilename: record?.sourceFilename || '', pageNumber: record?.pageNumber || 0 };
    })
    .sort((a, b) => a.sourceFilename.localeCompare(b.sourceFilename) || a.pageNumber - b.pageNumber);

  const AI_CLASSIFY_CONCURRENCY = 10;
  let classifyIdx = 0;

  async function classifyWorker() {
    while (classifyIdx < pagesWithText.length) {
      const i = classifyIdx++;
      const page = pagesWithText[i];
      try {
        let classifiedDocs;
        if (process.env.GEMINI_API_KEY) {
          const detected = await classifyAndExtractWithAI(page.ocrText);
          classifiedDocs = detected.map((doc) => ({
            id: randomUUID(), jobId,
            documentType: doc.documentType, confidence: doc.confidence,
            sourceFilename: page.sourceFilename, pageIds: [page.pageId],
            extractedFields: doc.fields || {}, classificationMethod: 'ai_gemini',
          }));
        } else {
          classifiedDocs = classifyAndGroupPages([page]).map((doc) => ({
            id: randomUUID(), jobId,
            documentType: doc.documentType, confidence: doc.confidence,
            sourceFilename: doc.sourceFilename, pageIds: doc.pageIds,
            extractedFields: doc.extractedFields || {}, classificationMethod: 'rule_based',
          }));
        }
        if (classifiedDocs.length > 0) await repository.insertDocuments(classifiedDocs);
      } catch (e) {
        console.error(`[Classify] Page ${page.pageId} failed:`, e.message);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(AI_CLASSIFY_CONCURRENCY, pagesWithText.length) }, () => classifyWorker()));

  // All pages are processed and classified. Fetch all documents for Grouping.
  const savedDocs = await repository.getDocumentsByJob(jobId);

  // ─── STAGE 5: Grouping ─────────────────────────────────────────────────────
  await repository.updateJob(jobId, { status: 'grouping' });

  const nasabahGroups = groupByNasabah(savedDocs);

  // ─── STAGE 6: Completeness Check ───────────────────────────────────────────
  const ruleResults = evaluateAllNasabahRules(nasabahGroups, savedDocs);
  const completenessResults = checkAllCompleteness(nasabahGroups, savedDocs, ruleResults);

  // Save nasabah records
  const nasabahRecords = nasabahGroups.map((n) => {
    const completenessData = completenessResults.find((c) => c.nasabahId === n.id);
    return {
      id: n.id,
      jobId,
      fullName: n.fullName,
      nik: n.nik,
      address: n.address,
      documentIds: n.documentIds,
      completeness: completenessData?.completeness || {},
      completenessScore: completenessData?.completenessScore || 0,
    };
  });

  if (nasabahRecords.length > 0) {
    await repository.insertNasabah(nasabahRecords);
  }

  // Update document nasabah assignments
  for (const nasabah of nasabahGroups) {
    for (const docId of nasabah.documentIds) {
      await repository.updateDocument(docId, { nasabahId: nasabah.id }).catch(() => {});
    }
  }

  // ─── STAGE 7: Build final result summary ────────────────────────────────────
  const resultSummary = {
    totalFiles: files.length,
    totalPages,
    processedPages: processedCount,
    failedPages: flatResults.filter((r) => r.error).length,
    totalDocuments: savedDocs.length,
    totalNasabah: nasabahGroups.filter((n) => n.fullName !== UNIDENTIFIED_FULL_NAME).length,
    unidentifiedDocuments: nasabahGroups.find((n) => n.fullName === UNIDENTIFIED_FULL_NAME)?.documentIds.length || 0,
    nasabah: nasabahGroups.map((n) => {
      const completenessData = completenessResults.find((c) => c.nasabahId === n.id);
      return {
        id: n.id,
        fullName: n.fullName,
        nik: n.nik,
        documentCount: n.documentIds.length,
        completenessScore: completenessData?.completenessScore || 0,
        missing: completenessData?.completeness?.missing || [],
        warnings: completenessData?.completeness?.warnings || [],
        ruleSummary: completenessData?.completeness?.ruleSummary || undefined,
      };
    }),
  };

  await repository.updateJob(jobId, {
    status: 'completed',
    result: resultSummary,
    processedPages: processedCount,
    completedAt: new Date().toISOString(),
  });

  return resultSummary;
}

/**
 * Process a single batch of pages through OCR.
 */
async function processBatch(batchPages, onProgress) {
  const images = batchPages.map((page) => ({
    base64Data: page.base64Data,
    mimeType: page.mimeType,
    filename: `${page.sourceFilename}_p${page.pageNumber}`,
    pageId: page.id,
  }));

  return ocrBatch(images, { concurrency: OCR_CONCURRENCY, onProgress });
}

module.exports = {
  createAndProcessJob,
};
