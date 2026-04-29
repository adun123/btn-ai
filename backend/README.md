# BTN KPR House Assessment Backend

Backend-first Express API for a house/KPR assessment flow with two intake channels:

- `branch`: branch / bank-assisted submission with BTN-style block form OCR orchestration
- `bale`: lighter mobile/digital submission flow for KTP, KK, and slip gaji

## Current scope

This implementation is intentionally **database-free** and uses **in-memory storage** so API contracts, Swagger docs, and orchestration flow can be verified first.

That means:

- data is lost when the server restarts
- uploaded file content is stored in memory for the current process only
- `bale` extraction now calls Gemini OCR for `ktp`, `kk`, and `slip_gaji`
- `branch` extraction remains a placeholder/orchestration entry for future BTN block form OCR
- default demo model is `gemini-3-flash-preview` unless `GEMINI_MODEL` is overridden

## Run locally

```bash
npm install
npm start
```

Server:

- API base: `http://localhost:4000`
- Swagger UI: `http://localhost:4000/api-docs`
- OpenAPI JSON: `http://localhost:4000/openapi.json`

## Main endpoints

- `GET /health`
- `POST /cases`
- `GET /cases`
- `GET /cases/:caseId`
- `PATCH /cases/:caseId`
- `POST /cases/:caseId/status`
- `POST /cases/:caseId/location`
- `POST /cases/:caseId/evidence`
- `GET /cases/:caseId/evidence`
- `POST /cases/:caseId/extraction/start`
- `GET /cases/:caseId/extraction`

## What is `caseId`?

`caseId` is the unique ID for **one KPR submission / one assessment case**.

Think of it as the **folder ID** for a single application.

Once a case is created, everything else is attached to that same case:

- property location
- uploaded KTP / KK / slip gaji
- OCR results
- later: valuation, review, and report output

Typical flow:

1. `POST /cases` → create a new case
2. backend returns `data.id` → this is the `caseId`
3. use that `caseId` for all next steps

Example:

- `POST /cases/{caseId}/location`
- `POST /cases/{caseId}/evidence`
- `POST /cases/{caseId}/extraction/start`

Without `caseId`, the backend would not know which uploaded files and OCR results belong to which submission.

## Bale OCR behavior

`channel = bale` now supports real Gemini OCR on uploaded documents with these `documentType` values:

- `ktp`
- `kk`
- `slip_gaji`

The extraction response returns:

- `documents[]` per uploaded supported document
- `fields[]` flattened across all recognized documents
- confidence and review flags per field

If `GEMINI_API_KEY` is missing, Bale extraction returns an error instead of a mocked OCR result.

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

- endpoint: `POST /cases`
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

- endpoint: `POST /cases/{caseId}/evidence`
- for `bale`, use only these `documentType` values:
  - `ktp`
  - `kk`
  - `slip_gaji`

6. Start OCR:

- endpoint: `POST /cases/{caseId}/extraction/start`

7. Read OCR result:

- endpoint: `GET /cases/{caseId}/extraction`

### Option B — Manual API test from terminal / Postman

#### 1. Create case

```bash
curl -X POST http://localhost:4000/cases \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "bale",
    "applicant": { "fullName": "Test User" },
    "property": { "propertyType": "house" }
  }'
```

Save the returned `data.id`.

#### 2. Upload KTP / KK / slip gaji

```bash
curl -X POST http://localhost:4000/cases/<caseId>/evidence \
  -F "documentType=ktp" \
  -F "files=@/path/to/ktp.png"
```

#### 3. Start OCR

```bash
curl -X POST http://localhost:4000/cases/<caseId>/extraction/start
```

#### 4. Read OCR result

```bash
curl http://localhost:4000/cases/<caseId>/extraction
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

If `documentType` is wrong for Bale, the backend should return a 400 JSON error.

## Suggested verification flow

1. Create a case with `channel = branch` or `channel = bale`
2. Save location
3. Upload evidence files
4. Start extraction
5. Read extraction result

## Deployment note for demo

If deployed on Netlify or Vercel, point it to this backend as a separate API service. Keep `CORS_ORIGIN` aligned with the frontend URL during demo deployment.
