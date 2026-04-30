const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const { openApiSpec } = require('./openapi/spec');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

const healthRoutes = require('./modules/health/health.routes');
const caseRoutes = require('./modules/assessment-core/case.routes');
const locationRoutes = require('./modules/property-location/location.routes');
const evidenceRoutes = require('./modules/evidence-documents/evidence.routes');
const extractionRoutes = require('./modules/extraction/extraction.routes');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  explorer: true,
  swaggerOptions: { persistAuthorization: true },
}));
app.get('/openapi.json', (req, res) => res.json(openApiSpec));

app.use(healthRoutes);
app.use('/api', healthRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/cases', locationRoutes);
app.use('/api/cases', evidenceRoutes);
app.use('/api/cases', extractionRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
