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

## Struktur folder backend

Bagian ini menjelaskan isi folder `backend/` dari level folder sampai file utama agar alur kode lebih mudah ditelusuri.

| Path | Fungsi |
| --- | --- |
| `.env` | Konfigurasi lokal berisi secret asli. File ini tidak perlu dibaca/dibagikan karena berisi kredensial. |
| `.env.example` | Contoh nama environment variable yang harus disiapkan untuk Supabase, Gemini, port, dan CORS. |
| `package.json` | Metadata project Node.js, daftar dependency, dan script seperti `npm start` dan `npm test`. |
| `package-lock.json` | Lockfile dependency npm agar versi package konsisten antar mesin. |
| `README.md` | Dokumentasi backend, endpoint utama, flow OCR, dan penjelasan struktur folder ini. |
| `node_modules/` | Dependency hasil `npm install`. Folder generated ini tidak perlu diedit manual. |
| `src/` | Source code aplikasi Express. Semua route, service, repository, middleware, OpenAPI, dan util berada di sini. |
| `supabase/` | File pendukung Supabase, terutama migration schema database untuk tabel `cases` dan `evidence_documents`. |

### Isi `src/`

| Path | Fungsi |
| --- | --- |
| `src/app.js` | Membuat Express app, memasang middleware global, Swagger, route API, dan handler error. |
| `src/server.js` | Entry point lokal yang membaca `.env`, mengambil `app`, lalu menjalankan server di `PORT`. |
| `src/data/` | Boundary akses database: koneksi Supabase dan mapper dari bentuk row database ke object aplikasi. |
| `src/middlewares/` | Middleware lintas modul. Saat ini berisi handler 404 dan error response global. |
| `src/modules/` | Modul domain backend. Setiap modul memegang route/service/repository sesuai tanggung jawabnya. |
| `src/openapi/` | Konfigurasi Swagger/OpenAPI untuk dokumentasi API interaktif. |
| `src/utils/` | Helper umum seperti pembuat case, HTTP error, dan normalisasi snapshot case dari client. |

### Isi `src/data/`

| File | Fungsi |
| --- | --- |
| `case-mappers.js` | Mengubah nama field database `snake_case` menjadi response API `camelCase`, dan sebaliknya saat menyimpan case. |
| `supabase.js` | Membuat singleton Supabase client dari env dan mengubah error Supabase menjadi HTTP error konsisten. |

### Isi `src/middlewares/`

| File | Fungsi |
| --- | --- |
| `errorHandler.js` | Mengirim response JSON untuk route yang tidak ditemukan, error umum, dan error upload dari Multer. |

### Isi `src/modules/`

| Folder | Fungsi |
| --- | --- |
| `assessment-core/` | Lifecycle case KPR: create, list, detail, update, update status, delete, dan penyimpanan record case. |
| `evidence-documents/` | Upload dokumen evidence, validasi `documentType` berdasarkan channel, dan penyimpanan metadata/file. |
| `extraction/` | Orkestrasi OCR: branch masih placeholder, Bale menjalankan Gemini OCR dan menyimpan hasil ekstraksi. |
| `health/` | Endpoint health check untuk status service, konfigurasi Supabase, runtime, dan provider AI. |
| `property-location/` | Folder cadangan untuk modul lokasi properti; saat ini masih kosong. |
| `provider-gateway/` | Integrasi provider eksternal. Saat ini berisi service OCR Gemini. |

### File penting per modul

| File | Fungsi |
| --- | --- |
| `src/modules/assessment-core/case.routes.js` | Definisi endpoint REST untuk case dan anotasi OpenAPI-nya. |
| `src/modules/assessment-core/case.service.js` | Business logic case, validasi channel, audit trail, dan fallback snapshot client. |
| `src/modules/assessment-core/case.repository.js` | Query Supabase untuk save, get, list, delete case, termasuk hydrate evidence per case. |
| `src/modules/evidence-documents/evidence.routes.js` | Endpoint upload/list evidence untuk satu `caseId`. |
| `src/modules/evidence-documents/evidence.service.js` | Validasi dokumen per channel, konfigurasi Multer memory upload, dan pencatatan audit upload. |
| `src/modules/evidence-documents/evidence.repository.js` | Insert metadata evidence dan mengambil payload base64 dokumen untuk OCR. |
| `src/modules/extraction/extraction.routes.js` | Endpoint start extraction dan get extraction result. |
| `src/modules/extraction/extraction.service.js` | Memilih pipeline OCR berdasarkan channel, menjalankan Gemini untuk Bale, dan menolak mismatch tipe dokumen. |
| `src/modules/health/health.routes.js` | Endpoint `GET /health` untuk cek status backend dan konfigurasi runtime. |
| `src/modules/provider-gateway/gemini-ocr.service.js` | Prompt, retry, parsing JSON, dan normalisasi hasil OCR dari Gemini. |

### Isi `src/openapi/` dan `src/utils/`

| File | Fungsi |
| --- | --- |
| `src/openapi/spec.js` | Membuat spesifikasi OpenAPI dari JSDoc route dan schema response/request. |
| `src/utils/caseFactory.js` | Membuat object case baru beserta reference number, timestamp, status awal, dan audit awal. |
| `src/utils/clientCaseSnapshot.js` | Menormalkan snapshot case dari client sebagai fallback untuk runtime serverless. |
| `src/utils/httpError.js` | Helper kecil untuk membuat `Error` dengan `status` dan `details` agar dibaca error handler. |

### Isi `supabase/`

| File | Fungsi |
| --- | --- |
| `supabase/migrations/20260504_init_btn_assessment_persistence.sql` | Schema awal Supabase: tabel `cases`, tabel `evidence_documents`, index, trigger `updated_at`, dan RLS. |

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
