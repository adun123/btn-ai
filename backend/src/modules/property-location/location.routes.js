const express = require('express');
const service = require('./location.service');

const router = express.Router();

/**
 * @openapi
 * /cases/{caseId}/location:
 *   post:
 *     tags: [Locations]
 *     summary: Save or update property location
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
 *             $ref: '#/components/schemas/LocationPayload'
 *     responses:
 *       200:
 *         description: Updated case with location
 */
router.post('/:caseId/location', (req, res, next) => {
  try {
    res.json({ success: true, data: service.saveLocation(req.params.caseId, req.body || {}) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
