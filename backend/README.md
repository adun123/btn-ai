# BTN KPR House Assessment Backend

Backend-first Express API for a house/KPR assessment flow with two intake channels:

- `branch`: branch / bank-assisted submission with BTN-style block form OCR orchestration
- `bale`: lighter mobile/digital submission flow for KTP, KK, slip gaji, NPWP, and rekening koran

## Current scope

This implementation now persists data in **Supabase Postgres** so API contracts, Swagger docs, and orchestration flow can be verified without losing every case on server restart.

That means:

- case data and uploaded evidence are stored in Supabase tables
- uploaded file payload is currently stored as base64 in the database for PoC simplicity
- `bale` extraction now calls Gemini OCR for `ktp`, `kk`, `slip_gaji`, `npwp`, and `rekening_koran`
- `branch` extraction remains a placeholder/orchestration entry for future BTN block form OCR
- default demo model is `gemini-3-flash-preview` unless `GEMINI_MODEL` is overridden

Required backend env:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` for Bale OCR

## Run locally

```bash
npm install
npm start
```

Server:

- API base: `http://localhost:4000`
- Swagger UI: `http://localhost:4000/api-docs`
- OpenAPI JSON: `http://localhost:4000/openapi.json`

Schema snapshot for this repo is tracked in `backend/supabase/migrations/20260504_init_btn_assessment_persistence.sql`.

## Main endpoints

- `GET /health`
- `POST /api/cases`
- `GET /api/cases`
- `GET /api/cases/:caseId`
- `PATCH /api/cases/:caseId`
- `POST /api/cases/:caseId/status`
- `POST /api/cases/:caseId/location`
- `POST /api/cases/:caseId/evidence`
- `GET /api/cases/:caseId/evidence`
- `POST /api/cases/:caseId/extraction/start`
- `GET /api/cases/:caseId/extraction`

## What is `caseId`?

`caseId` is the unique ID for **one KPR submission / one assessment case**.

Think of it as the **folder ID** for a single application.

Once a case is created, everything else is attached to that same case:

- property location
- uploaded KTP / KK / slip gaji / NPWP / rekening koran
- OCR results
- later: valuation, review, and report output

Typical flow:

1. `POST /api/cases` → create a new case
2. backend returns `data.id` → this is the `caseId`
3. use that `caseId` for all next steps

Example:

- `POST /api/cases/{caseId}/location`
- `POST /api/cases/{caseId}/evidence`
- `POST /api/cases/{caseId}/extraction/start`

Without `caseId`, the backend would not know which uploaded files and OCR results belong to which submission.

## Bale OCR behavior

`channel = bale` now supports real Gemini OCR on uploaded documents with these `documentType` values:

- `ktp`
- `kk`
- `slip_gaji`
- `npwp`
- `rekening_koran`

The extraction response returns:

- `documents[]` per uploaded supported document
- `fields[]` flattened across all recognized documents
- confidence and review flags per field

If `GEMINI_API_KEY` is missing, Bale extraction returns an error instead of a mocked OCR result.

If the uploaded Bale `documentType` does not match the document type Gemini detects from the visible file content, extraction is rejected with a 400 error. For example, uploading a rekening koran while labeling it as `ktp` will not be accepted.

## Development test flow

### Option A — Swagger UI

1. Run backend:

```bash
npm install
npm start
```

2. Open:

- `http://localhost:4000/api-docs`

3. Create a case first:

- endpoint: `POST /api/cases`
- body example:

```json
{
  "channel": "bale",
  "applicant": {
    "fullName": "Test User"
  },
  "property": {
    "propertyType": "house"
  }
}
```

4. Copy `data.id` from the response. That is your `caseId`.

5. Upload evidence using the same `caseId`:

- endpoint: `POST /api/cases/{caseId}/evidence`
- for `bale`, use only these `documentType` values:
  - `ktp`
  - `kk`
  - `slip_gaji`
  - `npwp`
  - `rekening_koran`

6. Start OCR:

- endpoint: `POST /api/cases/{caseId}/extraction/start`

7. Read OCR result:

- endpoint: `GET /api/cases/{caseId}/extraction`

### Option B — Manual API test from terminal / Postman

#### 1. Create case

```bash
curl -X POST http://localhost:4000/api/cases \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "bale",
    "applicant": { "fullName": "Test User" },
    "property": { "propertyType": "house" }
  }'
```

Save the returned `data.id`.

#### 2. Upload KTP / KK / slip gaji / NPWP / rekening koran

```bash
curl -X POST http://localhost:4000/api/cases/<caseId>/evidence \
  -F "documentType=ktp" \
  -F "files=@/path/to/ktp.png"
```

#### 3. Start OCR

```bash
curl -X POST http://localhost:4000/api/cases/<caseId>/extraction/start
```

#### 4. Read OCR result

```bash
curl http://localhost:4000/api/cases/<caseId>/extraction
```

## What to expect during development

- `branch` channel is still a placeholder for future BTN block form OCR
- `bale` channel already calls Gemini OCR
- OCR quality depends on:
  - image clarity
  - crop quality
  - visible text completeness
  - Gemini model availability

If Gemini is overloaded, the backend should now return a clean JSON error like:

```json
{
  "success": false,
  "error": "Gemini OCR is temporarily unavailable. Please retry in a moment."
}
```

If `documentType` is wrong for Bale, or the visible uploaded document does not match the selected Bale `documentType`, the backend should return a 400 JSON error.

## Suggested verification flow

1. Create a case with `channel = branch` or `channel = bale`
2. Save location
3. Upload evidence files
4. Start extraction
5. Read extraction result

## Deployment note for demo

If deployed on Netlify or Vercel, point it to this backend as a separate API service. Keep `CORS_ORIGIN` aligned with the frontend URL during demo deployment.
