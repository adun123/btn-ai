const express = require('express');
const service = require('./evidence.service');

const router = express.Router();

/**
 * @openapi
 * /cases/{caseId}/evidence:
 *   post:
 *     tags: [Evidence]
 *     summary: Upload evidence files for a case
 *     description: Bale only accepts documentType values `ktp`, `kk`, or `slip_gaji`. Branch accepts `application_form`, `supporting_document`, `salary_slip`, or `other`.
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [files]
 *             properties:
 *               documentType:
 *                 type: string
 *                 example: ktp
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
 *       400:
 *         description: Invalid documentType for the case channel
 */
router.post('/:caseId/evidence', service.upload.array('files', 10), (req, res, next) => {
  try {
    res.json({ success: true, data: service.addEvidence(req.params.caseId, req.files, req.body || {}) });
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
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Evidence list
 */
router.get('/:caseId/evidence', (req, res, next) => {
  try {
    res.json({ success: true, data: service.listEvidence(req.params.caseId) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
