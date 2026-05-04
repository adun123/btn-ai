const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const { openApiSpec } = require('./openapi/spec');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

const healthRoutes = require('./modules/health/health.routes');
const caseRoutes = require('./modules/assessment-core/case.routes');
const evidenceRoutes = require('./modules/evidence-documents/evidence.routes');
const extractionRoutes = require('./modules/extraction/extraction.routes');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

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
app.use('/api/cases', caseRoutes);
app.use('/api/cases', evidenceRoutes);
app.use('/api/cases', extractionRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
