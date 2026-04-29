const express = require('express');
const service = require('./extraction.service');

const router = express.Router();

/**
 * @openapi
 * /cases/{caseId}/extraction/start:
 *   post:
 *     tags: [Extraction]
 *     summary: Start extraction flow based on channel
 *     description: Branch uses BTN-style block form OCR orchestration. Bale uses lightweight document OCR orchestration.
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Extraction result generated
 */
router.post('/:caseId/extraction/start', async (req, res, next) => {
  try {
    res.json({ success: true, data: await service.startExtraction(req.params.caseId) });
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
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Extraction detail
 */
router.get('/:caseId/extraction', (req, res, next) => {
  try {
    res.json({ success: true, data: service.getExtraction(req.params.caseId) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
