const express = require('express');
const service = require('./case.service');

const router = express.Router();

/**
 * @openapi
 * /cases:
 *   post:
 *     tags: [Assessment Cases]
 *     summary: Create a new assessment case
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCasePayload'
 *     responses:
 *       201:
 *         description: Assessment case created
 */
router.post('/', async (req, res, next) => {
  try {
    const record = await service.createCase(req.body || {});
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /cases:
 *   get:
 *     tags: [Assessment Cases]
 *     summary: List assessment cases
 *     responses:
 *       200:
 *         description: List of cases
 */
router.get('/', async (req, res, next) => {
  try {
    res.json({ success: true, data: await service.getCaseList() });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /cases/{caseId}:
 *   get:
 *     tags: [Assessment Cases]
 *     summary: Get case detail
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Case detail
 */
router.get('/:caseId', async (req, res, next) => {
  try {
    res.json({ success: true, data: await service.getCase(req.params.caseId) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:caseId', async (req, res, next) => {
  try {
    res.json({ success: true, data: await service.deleteCase(req.params.caseId) });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /cases/{caseId}:
 *   patch:
 *     tags: [Assessment Cases]
 *     summary: Update applicant, property, or notes
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated case
 */
router.patch('/:caseId', async (req, res, next) => {
  try {
    res.json({ success: true, data: await service.patchCase(req.params.caseId, req.body || {}) });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /cases/{caseId}/status:
 *   post:
 *     tags: [Assessment Cases]
 *     summary: Update case status
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 example: evidence_uploaded
 *     responses:
 *       200:
 *         description: Updated status
 */
router.post('/:caseId/status', async (req, res, next) => {
  try {
    res.json({ success: true, data: await service.updateStatus(req.params.caseId, req.body || {}) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
