const express = require('express');
const service = require('./evidence.service');

const router = express.Router();

/**
 * @openapi
 * /cases/{caseId}/evidence/presigned-url:
 *   post:
 *     tags: [Evidence]
 *     summary: Get presigned URL for direct S3 upload
 *     description: Returns a presigned URL that the client can use to upload directly to S3.
 *     parameters:
 *       - name: caseId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - filename
 *               - contentType
 *               - documentType
 *             properties:
 *               filename:
 *                 type: string
 *               contentType:
 *                 type: string
 *               documentType:
 *                 type: string
 *               size:
 *                 type: number
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Presigned URL generated
 */
router.post('/:caseId/evidence/presigned-url', async (req, res, next) => {
  try {
    const result = await service.getPresignedUrl(req.params.caseId, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /cases/{caseId}/evidence/confirm-upload:
 *   post:
 *     tags: [Evidence]
 *     summary: Confirm S3 upload and create evidence record
 *     description: Called after successful S3 upload to create the evidence record in the database.
 *     parameters:
 *       - name: caseId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - evidenceId
 *               - key
 *             properties:
 *               evidenceId:
 *                 type: string
 *               key:
 *                 type: string
 *     responses:
 *       200:
 *         description: Evidence record created
 */
router.post('/:caseId/evidence/confirm-upload', async (req, res, next) => {
  try {
    const result = await service.confirmS3Upload(req.params.caseId, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /cases/{caseId}/evidence:
 *   post:
 *     tags: [Evidence]
 *     summary: Upload evidence files for a case (legacy)
 *     description: Legacy endpoint that stores files as base64. For production use presigned-url endpoint instead.
 *     parameters:
 *       - name: caseId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - files
 *             properties:
 *               documentType:
 *                 type: string
 *               notes:
 *                 type: string
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Evidence uploaded
 */
router.post('/:caseId/evidence', service.upload.array('files', 10), async (req, res, next) => {
  try {
    res.json({ success: true, data: await service.addEvidence(req.params.caseId, req.files, req.body || {}) });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /cases/{caseId}/evidence:
 *   get:
 *     tags: [Evidence]
 *     summary: List evidence for a case
 *     parameters:
 *       - name: caseId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Evidence list
 */
router.get('/:caseId/evidence', async (req, res, next) => {
  try {
    res.json({ success: true, data: await service.listEvidence(req.params.caseId) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
