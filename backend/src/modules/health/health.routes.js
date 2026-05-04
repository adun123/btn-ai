const express = require('express');
const { isSupabaseConfigured } = require('../../data/supabase');

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
      database: isSupabaseConfigured() ? 'supabase_configured' : 'supabase_not_configured',
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
