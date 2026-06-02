const express = require('express');
const multer = require('multer');
const service = require('./bulk.service');
const storageService = require('./bulk-storage.service');
const { createAndProcessJob } = require('./bulk-orchestrator.service');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 1000, // Max 1000 files in one request
  },
});

/**
 * @openapi
 * /bulk/upload:
 *   post:
 *     tags: [Bulk OCR Processing]
 *     summary: Upload files for bulk OCR processing
 *     description: |
 *       Accepts either:
 *       - A single ZIP file containing multiple PDFs/images
 *       - Multiple PDF/image files uploaded directly
 *
 *       Processing runs in background. Use the returned jobId to poll for status.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [files]
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: ZIP file or multiple PDF/image files
 *     responses:
 *       202:
 *         description: Job created, processing started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                     status:
 *                       type: string
 *       400:
 *         description: Invalid upload
 */
router.post('/upload', upload.array('files', 1000), async (req, res, next) => {
  try {
    const result = await service.handleBulkUpload(req.files);
    res.status(202).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /bulk/jobs:
 *   get:
 *     tags: [Bulk OCR Processing]
 *     summary: List bulk processing jobs
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of jobs
 */
router.get('/jobs', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const jobs = await service.listJobs(limit);
    res.json({ success: true, data: jobs });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /bulk/jobs/{jobId}:
 *   get:
 *     tags: [Bulk OCR Processing]
 *     summary: Get job status
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job status and summary
 *       404:
 *         description: Job not found
 */
router.get('/jobs/:jobId', async (req, res, next) => {
  try {
    const job = await service.getJobStatus(req.params.jobId);
    res.json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /bulk/jobs/{jobId}:
 *   delete:
 *     tags: [Bulk OCR Processing]
 *     summary: Delete a job and all its data (pages, documents, nasabah)
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job deleted
 *       404:
 *         description: Job not found
 */
router.delete('/jobs/:jobId', async (req, res, next) => {
  try {
    await service.deleteJob(req.params.jobId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/jobs/:jobId/nasabah/:nasabahId', async (req, res, next) => {
  try {
    console.log(`[deleteNasabah] jobId=${req.params.jobId} nasabahId=${req.params.nasabahId}`);
    await service.deleteNasabah(req.params.nasabahId);
    console.log(`[deleteNasabah] success nasabahId=${req.params.nasabahId}`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[deleteNasabah] error:`, error);
    next(error);
  }
});

/**
 * @openapi
 * /bulk/jobs/{jobId}/details:
 *   get:
 *     tags: [Bulk OCR Processing]
 *     summary: Get full job details including documents, nasabah, and pages
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Full job details
 *       404:
 *         description: Job not found
 */
router.get('/jobs/:jobId/details', async (req, res, next) => {
  try {
    const details = await service.getJobDetails(req.params.jobId);
    res.json({ success: true, data: details });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /bulk/jobs/{jobId}/pages/{pageId}:
 *   get:
 *     tags: [Bulk OCR Processing]
 *     summary: Get full OCR data for a specific page
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: pageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Page OCR details
 *       404:
 *         description: Page not found
 */
router.get('/jobs/:jobId/pages/:pageId', async (req, res, next) => {
  try {
    const page = await service.getPageOcrData(req.params.jobId, req.params.pageId);
    res.json({ success: true, data: page });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /bulk/presign:
 *   post:
 *     tags: [Bulk OCR Processing]
 *     summary: Generate presigned upload URLs for direct-to-storage upload
 *     description: |
 *       Returns signed URLs so the client can upload files directly to Supabase Storage,
 *       bypassing the serverless function body size limit.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [files]
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     filename:
 *                       type: string
 *                     contentType:
 *                       type: string
 *     responses:
 *       200:
 *         description: Signed URLs generated
 */
router.post('/presign', async (req, res, next) => {
  try {
    const result = await storageService.generatePresignedUrls(req.body.files);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /bulk/process-storage:
 *   post:
 *     tags: [Bulk OCR Processing]
 *     summary: Trigger bulk processing from files already uploaded to storage
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [uploadId, files]
 *             properties:
 *               uploadId:
 *                 type: string
 *               files:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     filename:
 *                       type: string
 *                     path:
 *                       type: string
 *                     contentType:
 *                       type: string
 *     responses:
 *       202:
 *         description: Job created, processing started
 */
router.post('/process-storage', async (req, res, next) => {
  try {
    const { uploadId, files } = req.body;
    if (!uploadId || !files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'uploadId and files are required' });
    }

    console.log(`[process-storage] uploadId=${uploadId} files=${JSON.stringify(files.map(f => ({ filename: f.filename, path: f.path, contentType: f.contentType })))}`);

    const downloaded = await storageService.downloadFromStorage(uploadId, files);
    console.log(`[process-storage] downloaded ${downloaded.length} file(s): ${downloaded.map(f => `${f.originalname} (${f.size} bytes)`).join(', ')}`);

    const result = await service.handleBulkUpload(downloaded);
    console.log(`[process-storage] job created: ${JSON.stringify(result)}`);

    // Cleanup storage in background
    storageService.cleanupUpload(uploadId).catch((e) => console.warn('[process-storage] cleanup failed:', e.message));

    res.status(202).json({ success: true, data: result });
  } catch (error) {
    console.error('[process-storage] error:', error);
    next(error);
  }
});

module.exports = router;
