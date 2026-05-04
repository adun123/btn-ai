const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createHttpError } = require('../../utils/httpError');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

const DOCUMENT_FIELD_TEMPLATES = {
  ktp: ['nik', 'full_name', 'birth_place', 'birth_date', 'address', 'rt_rw', 'kelurahan', 'kecamatan', 'religion', 'marital_status', 'occupation'],
  kk: ['nomor_kk', 'kepala_keluarga', 'alamat', 'rt_rw', 'desa_kelurahan', 'kecamatan', 'kabupaten_kota', 'provinsi', 'members'],
  slip_gaji: ['employee_name', 'company_name', 'period', 'position', 'gross_income', 'net_income', 'deductions'],
  npwp: ['npwp_number', 'registered_name', 'address', 'effective_date'],
  rekening_koran: ['account_holder_name', 'bank_name', 'account_number', 'statement_period', 'opening_balance', 'closing_balance', 'transactions'],
};

function getModel() {
  if (!process.env.GEMINI_API_KEY) {
    throw createHttpError(503, 'GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({
    model: DEFAULT_MODEL,
    generationConfig: {
      temperature: 0,
      topK: 1,
      topP: 0.1,
      responseMimeType: 'application/json',
    },
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt(documentType) {
  const expectedFields = DOCUMENT_FIELD_TEMPLATES[documentType] || [];

  return `You are an OCR and structured extraction system for Indonesian mortgage onboarding documents.

Document type hint: ${documentType}.
Target language: preserve Indonesian text exactly when visible.

Extract the visible content and return ONLY valid JSON in this exact structure:
{
  "document_type": "${documentType}",
  "confidence": 0.0,
  "summary": "short summary",
  "fields": [
    {
      "key": "field_name",
      "value": "field value or null",
      "confidence": 0.0,
      "reviewRequired": false,
      "notes": "optional note or null"
    }
  ],
  "warnings": ["warning text"]
}

Expected fields for this document type: ${expectedFields.join(', ') || 'generic visible fields only'}.

Rules:
- Do not invent values.
- If a field is unclear, set value to null and set reviewRequired to true.
- If the document type hint appears wrong, still extract the visible document but keep document_type as the actual visible document if obvious.
- For number-like values, preserve the exact string as printed.
- Confidence must be between 0 and 1.`;
}

function normalizeGeminiPayload(parsed, fallbackType) {
  const fields = Array.isArray(parsed?.fields)
    ? parsed.fields.map((field) => ({
      key: String(field?.key || 'unknown_field'),
      value: field?.value == null ? null : String(field.value),
      confidence: Number.isFinite(field?.confidence) ? Number(field.confidence) : 0,
      source: 'gemini_ocr',
      reviewRequired: Boolean(field?.reviewRequired),
      notes: field?.notes == null ? null : String(field.notes),
    }))
    : [];

  const normalizedDocumentType = String(parsed?.document_type || fallbackType);
  const filteredFields = normalizedDocumentType === 'npwp'
    ? fields.filter((field) => !['nik', 'kpp_registered'].includes(field.key))
    : fields;

  return {
    documentType: normalizedDocumentType,
    confidence: Number.isFinite(parsed?.confidence) ? Number(parsed.confidence) : 0,
    summary: typeof parsed?.summary === 'string' ? parsed.summary : 'OCR extraction completed.',
    fields: filteredFields,
    warnings: Array.isArray(parsed?.warnings) ? parsed.warnings.map((item) => String(item)) : [],
  };
}

async function extractDocument({ documentType, mimeType, base64Data }) {
  const model = getModel();
  let result;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: buildPrompt(documentType) },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        }],
      });
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable = message.includes('503') || message.includes('429') || message.includes('high demand');

      if (!retryable || attempt === 3) {
        throw createHttpError(503, 'Gemini OCR is temporarily unavailable. Please retry in a moment.', {
          provider: 'gemini',
          documentType,
          reason: message,
        });
      }

      await sleep(attempt * 1000);
    }
  }

  const response = await result.response;
  const text = response.text();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw createHttpError(502, 'Gemini returned non-JSON OCR output', { raw: text.slice(0, 1000) });
  }

  return normalizeGeminiPayload(parsed, documentType);
}

module.exports = {
  extractDocument,
};
