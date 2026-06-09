const express = require('express');
const service = require('./extraction.service');

const router = express.Router();

/**
 * @openapi
 * /cases/{caseId}/extraction/start:
 *   post:
 *     tags: [Extraction]
 *     summary: Start extraction flow based on channel (async)
 *     description: Returns a jobId for async processing.
 *     parameters:
 *       - name: caseId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Extraction job started
 */
router.post('/:caseId/extraction/start', async (req, res, next) => {
  try {
    res.json({ success: true, data: await service.startExtraction(req.params.caseId, req.body || {}) });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /jobs/{jobId}/status:
 *   get:
 *     tags: [Extraction]
 *     summary: Get processing job status
 *     parameters:
 *       - name: jobId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job status
 */
router.get('/jobs/:jobId/status', async (req, res, next) => {
  try {
    res.json({ success: true, data: await service.getJobStatus(req.params.jobId) });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /cases/{caseId}/extraction:
 *   get:
 *     tags: [Extraction]
 *     summary: Get extraction result for a case
 *     parameters:
 *       - name: caseId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Extraction detail
 */
router.get('/:caseId/extraction', async (req, res, next) => {
  try {
    res.json({ success: true, data: await service.getExtraction(req.params.caseId) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
