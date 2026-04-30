const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'BTN KPR House Assessment API',
      version: '1.0.0',
      description: 'Backend-first API for branch and Bale KPR house assessment flows. This version uses in-memory storage only.',
    },
    tags: [
      { name: 'Health', description: 'Server status and metadata' },
      { name: 'Assessment Cases', description: 'Case lifecycle and metadata' },
      { name: 'Locations', description: 'Property location capture and confirmation' },
      { name: 'Evidence', description: 'Uploaded files and evidence metadata' },
      { name: 'Extraction', description: 'OCR/extraction orchestration by submission channel' },
    ],
    components: {
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Validation failed' },
            details: { type: 'object', nullable: true },
          },
        },
        DocumentTypeMismatchDetails: {
          type: 'object',
          properties: {
            code: { type: 'string', example: 'DOCUMENT_TYPE_MISMATCH' },
            channel: { type: 'string', example: 'bale' },
            expected: { type: 'string', example: 'ktp' },
            detected: { type: 'string', example: 'rekening_koran' },
            evidenceId: { type: 'string', format: 'uuid' },
            filename: { type: 'string', example: 'rekening.txt' },
          },
        },
        DocumentTypeMismatchErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'string',
              example: 'Uploaded documentType "ktp" does not match the detected document type "rekening_koran". Bale extraction rejected.',
            },
            details: {
              allOf: [{ $ref: '#/components/schemas/DocumentTypeMismatchDetails' }],
              nullable: true,
            },
          },
        },
        CreateCasePayload: {
          type: 'object',
          required: ['channel'],
          properties: {
            channel: { type: 'string', enum: ['branch', 'bale'] },
            applicant: { type: 'object', additionalProperties: true },
            property: { type: 'object', additionalProperties: true },
            notes: { type: 'string' },
          },
        },
        LocationPayload: {
          type: 'object',
          required: ['rawAddressText'],
          properties: {
            rawAddressText: { type: 'string' },
            normalizedAddressText: { type: 'string' },
            province: { type: 'string' },
            cityRegency: { type: 'string' },
            district: { type: 'string' },
            subdistrict: { type: 'string' },
            postalCode: { type: 'string' },
            latitude: { type: 'number', nullable: true },
            longitude: { type: 'number', nullable: true },
            geocodeConfidence: { type: 'number', nullable: true },
            manuallyConfirmed: { type: 'boolean', default: false },
          },
        },
        EvidenceItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            documentType: { type: 'string', example: 'npwp', description: 'For bale: ktp, kk, slip_gaji, npwp, rekening_koran. For branch: application_form, supporting_document, salary_slip, other.' },
            filename: { type: 'string' },
            mimetype: { type: 'string' },
            size: { type: 'number' },
            notes: { type: 'string' },
            uploadedAt: { type: 'string', format: 'date-time' },
          },
        },
        ExtractionResult: {
          type: 'object',
          properties: {
            channel: { type: 'string', enum: ['branch', 'bale'] },
            status: { type: 'string', example: 'completed' },
            pipeline: { type: 'string' },
            generatedAt: { type: 'string', format: 'date-time' },
            summary: { type: 'string' },
            documents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  evidenceId: { type: 'string', format: 'uuid' },
                  filename: { type: 'string' },
                  documentType: { type: 'string' },
                  confidence: { type: 'number' },
                  summary: { type: 'string' },
                  fields: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        key: { type: 'string' },
                        value: { type: 'string', nullable: true },
                        confidence: { type: 'number' },
                        source: { type: 'string' },
                        reviewRequired: { type: 'boolean' },
                        notes: { type: 'string', nullable: true },
                      },
                    },
                  },
                  warnings: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
            },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  value: { type: 'string', nullable: true },
                  confidence: { type: 'number' },
                  source: { type: 'string' },
                  reviewRequired: { type: 'boolean' },
                  notes: { type: 'string', nullable: true },
                },
              },
            },
            warnings: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        AssessmentCase: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            referenceNumber: { type: 'string' },
            channel: { type: 'string', enum: ['branch', 'bale'] },
            status: { type: 'string' },
            applicant: { type: 'object', additionalProperties: true },
            property: { type: 'object', additionalProperties: true },
            notes: { type: 'string' },
            location: {
              allOf: [{ $ref: '#/components/schemas/LocationPayload' }],
              nullable: true,
            },
            evidence: {
              type: 'array',
              items: { $ref: '#/components/schemas/EvidenceItem' },
            },
            extraction: {
              allOf: [{ $ref: '#/components/schemas/ExtractionResult' }],
              nullable: true,
            },
            auditTrail: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  action: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                  payload: { type: 'object', additionalProperties: true },
                },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.js'],
};

const openApiSpec = swaggerJSDoc(options);

module.exports = { openApiSpec };
