const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { JOB_ID, nasabah, documents, pages, completedJob } = require('./bulk.mock-data');

const router = Router();

// POST /api/bulk/upload — return jobId instantly (202)
router.post('/upload', (req, res) => {
  res.status(202).json({
    success: true,
    data: { jobId: JOB_ID, status: 'pending' },
  });
});

// GET /api/bulk/jobs — list all jobs
router.get('/jobs', (req, res) => {
  res.json({
    success: true,
    data: [completedJob],
  });
});

// GET /api/bulk/jobs/:jobId — status + progress (polling)
router.get('/jobs/:jobId', (req, res) => {
  if (req.params.jobId !== JOB_ID) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }
  res.json({ success: true, data: completedJob });
});

// GET /api/bulk/jobs/:jobId/details — full result
router.get('/jobs/:jobId/details', (req, res) => {
  if (req.params.jobId !== JOB_ID) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }
  res.json({
    success: true,
    data: {
      ...completedJob,
      result: {
        totalFiles: completedJob.totalFiles,
        totalPages: completedJob.totalPages,
        processedPages: completedJob.processedPages,
        failedPages: completedJob.failedPages,
        totalDocuments: documents.length,
        totalNasabah: nasabah.length,
        unidentifiedDocuments: 0,
        nasabah,
      },
      documents,
      nasabah,
      pages,
    },
  });
});

module.exports = router;
