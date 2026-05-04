const express = require('express');

const router = express.Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check
 *     responses:
 *       200:
 *         description: Server health and feature metadata
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'btn-kpr-house-assessment-backend',
      storageMode: 'supabase',
      database: process.env.SUPABASE_URL ? 'supabase_url_present' : 'supabase_url_not_set',
      aiProvider: process.env.GEMINI_API_KEY ? 'gemini_key_present' : 'gemini_key_not_set',
      supportedChannels: ['branch', 'bale'],
      extractionPipelines: {
        branch: 'btn_block_form_ocr',
        bale: 'gemini_document_ocr',
      },
      timestamp: new Date().toISOString(),
    },
  });
});

module.exports = router;
