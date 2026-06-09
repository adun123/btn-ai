const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const { openApiSpec } = require('./openapi/spec');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

const healthRoutes = require('./modules/health/health.routes');
const caseRoutes = require('./modules/assessment-core/case.routes');
const evidenceRoutes = require('./modules/evidence-documents/evidence.routes');
const extractionRoutes = require('./modules/extraction/extraction.routes');
const bulkRoutes = require('./modules/bulk-processing/bulk.routes');
const { getJobStatus } = require('./modules/extraction/extraction.service');

const app = express();

// Trust proxy headers when behind nginx/Cloudflare
app.set('trust proxy', true);

// Parse CORS origins from environment variable
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : '*';

// Configure CORS
app.use(cors({
  origin: Array.isArray(corsOrigins) ? corsOrigins : corsOrigins,
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  explorer: true,
  swaggerOptions: { persistAuthorization: true },
}));
app.get('/openapi.json', (req, res) => res.json(openApiSpec));

app.use(healthRoutes);
app.use('/api', healthRoutes);
// Support both local server path (/api/...) and Vercel function path (/...).
app.use('/cases', caseRoutes);
app.use('/cases', evidenceRoutes);
app.use('/cases', extractionRoutes);
app.use('/bulk', bulkRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/cases', evidenceRoutes);
app.use('/api/cases', extractionRoutes);
app.use('/api/bulk', bulkRoutes);

// Job status endpoint (separate from cases routes)
app.get('/api/jobs/:jobId/status', async (req, res, next) => {
  try {
    res.json({ success: true, data: await getJobStatus(req.params.jobId) });
  } catch (error) {
    next(error);
  }
});



app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
