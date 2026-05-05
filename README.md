# BTN AI - KPR OCR Submission Workflow

BTN AI adalah proof of concept (PoC) untuk membantu proses awal pengajuan KPR BTN melalui workflow berbasis case. Aplikasi ini menggabungkan frontend Next.js, backend Express, Supabase Postgres, dan OCR berbasis Gemini untuk membaca dokumen onboarding KPR.

Dokumen ini ditulis agar mudah dipahami oleh PM, engineer, dan stakeholder demo.

## Ringkasan Produk

Tujuan utama proyek ini adalah mempercepat proses intake dokumen KPR dengan alur yang lebih terstruktur:

1. Membuat case pengajuan KPR.
2. Mengunggah dokumen pendukung.
3. Menjalankan OCR untuk mengekstrak data penting.
4. Menampilkan hasil ekstraksi agar bisa direview dan dikoreksi manual.
5. Menyimpan riwayat case, evidence, dan hasil OCR untuk kebutuhan audit/demo.

## Status Saat Ini

| Area | Status | Catatan |
| --- | --- | --- |
| Frontend workflow | Sudah tersedia | UI 4 langkah: create case, upload documents, start OCR, OCR result. |
| Backend API | Sudah tersedia | Express API dengan Swagger/OpenAPI. |
| Persistence | Sudah tersedia | Data disimpan di Supabase Postgres. |
| Bale OCR | Sudah tersedia | Menggunakan Gemini OCR untuk beberapa tipe dokumen. |
| Branch OCR | Placeholder | Struktur pipeline ada, tetapi hasil OCR masih dummy. |
| Automated test | Belum tersedia | Script backend test saat ini hanya placeholder. |

## Channel Intake

Aplikasi mendukung dua channel intake:

| Channel | Tujuan | Dokumen yang didukung | Status OCR |
| --- | --- | --- | --- |
| `bale` | Intake digital/mobile-style | KTP, KK, NPWP, slip gaji, rekening koran | Real OCR via Gemini |
| `branch` | Intake dibantu kantor cabang | Application form, supporting document, salary slip, other | Placeholder |

## User Flow Utama

```text
Create Case -> Upload Documents -> Start OCR -> Review OCR Result
```

Penjelasan singkat:

1. User memilih channel `bale` atau `branch`.
2. Frontend membuat case baru melalui backend.
3. User mengunggah dokumen yang sesuai dengan channel.
4. Backend menyimpan file dan metadata evidence di Supabase.
5. Untuk channel `bale`, backend mengirim dokumen ke Gemini OCR.
6. Hasil OCR dikembalikan ke frontend.
7. User dapat mereview dan mengedit hasil ekstraksi secara manual.

## Arsitektur Singkat

```text
Frontend Next.js
    |
    | REST API
    v
Backend Express
    |
    |-- Supabase Postgres: cases dan evidence_documents
    |-- Gemini OCR: ekstraksi dokumen channel bale
    |-- Swagger/OpenAPI: dokumentasi API
```

Pembagian tanggung jawab:

- `frontend/` menangani UI, workflow state, upload progress, dan tampilan hasil OCR.
- `backend/` menangani API, validasi channel/dokumen, upload evidence, persistence, dan integrasi OCR.
- `docs/` menyimpan blueprint arsitektur dan dokumen referensi.
- `api/` menyediakan entrypoint serverless untuk deployment yang membutuhkan function wrapper.

## Struktur Folder

Generated/build folders seperti `node_modules/`, `.next/`, dan `tsconfig.tsbuildinfo` tidak perlu dibaca untuk memahami produk.

```text
OCR/
├── README.md
├── .gitignore
├── api/
│   └── index.js
├── backend/
│   ├── README.md
│   ├── .env.example
│   ├── package.json
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── data/
│   │   ├── middlewares/
│   │   ├── modules/
│   │   │   ├── assessment-core/
│   │   │   ├── evidence-documents/
│   │   │   ├── extraction/
│   │   │   ├── health/
│   │   │   └── provider-gateway/
│   │   ├── openapi/
│   │   └── utils/
│   └── supabase/
│       └── migrations/
├── docs/
│   ├── 2026-04-29-arch-house-collateral-assessment-blueprint.md
│   ├── FORM-KPR-BTN.pdf
│   ├── pdf-print.css
│   └── doc test/
└── frontend/
    ├── .env.example
    ├── package.json
    ├── app/
    ├── components/
    ├── lib/
    ├── public/
    ├── store/
    └── types/
```

## Penjelasan Folder dan File Penting

### Root

| Path | Fungsi |
| --- | --- |
| `README.md` | Dokumentasi utama proyek. |
| `.gitignore` | Daftar file/folder yang tidak masuk git. |
| `api/index.js` | Wrapper serverless yang meneruskan request ke backend Express app. |

### Backend

| Path | Fungsi |
| --- | --- |
| `backend/src/app.js` | Wiring Express app, CORS, Swagger, route API, dan error handler. |
| `backend/src/server.js` | Entry point untuk menjalankan backend lokal. |
| `backend/src/modules/assessment-core/` | Modul lifecycle case: create, list, detail, patch, status, delete. |
| `backend/src/modules/evidence-documents/` | Modul upload dokumen, validasi tipe dokumen, dan penyimpanan evidence. |
| `backend/src/modules/extraction/` | Modul orkestrasi OCR untuk channel `bale` dan `branch`. |
| `backend/src/modules/provider-gateway/` | Integrasi provider eksternal, saat ini Gemini OCR. |
| `backend/src/data/` | Koneksi Supabase dan mapper data database ke format aplikasi. |
| `backend/src/openapi/spec.js` | Konfigurasi Swagger/OpenAPI. |
| `backend/supabase/migrations/` | Snapshot skema database Supabase. |

### Frontend

| Path | Fungsi |
| --- | --- |
| `frontend/app/page.tsx` | Halaman utama yang memuat workflow OCR. |
| `frontend/app/layout.tsx` | Layout Next.js, metadata, dan React Query provider. |
| `frontend/components/workflow/ocr-workflow-page.tsx` | Orkestrator utama UI workflow 4 langkah. |
| `frontend/components/workflow/steps/` | Komponen per langkah: create case, upload, proses OCR, hasil OCR. |
| `frontend/components/workflow/summary-panel.tsx` | Panel ringkasan case, dokumen, status, dan notes. |
| `frontend/lib/api.ts` | Client API untuk komunikasi frontend ke backend. |
| `frontend/lib/workflow.ts` | Definisi langkah workflow dan daftar dokumen per channel. |
| `frontend/store/workflow-store.ts` | State workflow yang dipersist di `sessionStorage`. |
| `frontend/types/ocr.ts` | TypeScript types untuk case, evidence, dan hasil OCR. |

### Docs

| Path | Fungsi |
| --- | --- |
| `docs/2026-04-29-arch-house-collateral-assessment-blueprint.md` | Blueprint arsitektur jangka panjang untuk collateral assessment. |
| `docs/FORM-KPR-BTN.pdf` | Referensi form KPR BTN. |
| `docs/doc test/` | Contoh dokumen/gambar untuk pengujian OCR. |

## Data yang Disimpan

Saat ini database Supabase memiliki dua tabel utama:

| Tabel | Isi |
| --- | --- |
| `public.cases` | Data case, channel, status, applicant/property JSON, notes, hasil extraction, manual edits, audit trail. |
| `public.evidence_documents` | Metadata dokumen dan payload file base64 untuk PoC. |

Catatan: untuk production, file sebaiknya dipindahkan ke object storage seperti Supabase Storage. Database cukup menyimpan metadata dan reference URL.

## Endpoint Utama

Backend tersedia di `http://localhost:4000` saat dijalankan lokal.

```text
GET    /health
GET    /api/health
POST   /api/cases
GET    /api/cases
GET    /api/cases/:caseId
PATCH  /api/cases/:caseId
DELETE /api/cases/:caseId
POST   /api/cases/:caseId/status
POST   /api/cases/:caseId/evidence
GET    /api/cases/:caseId/evidence
POST   /api/cases/:caseId/extraction/start
GET    /api/cases/:caseId/extraction
```

Dokumentasi API interaktif tersedia di:

```text
http://localhost:4000/api-docs
```

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- TanStack React Query
- Zustand
- Tailwind CSS 4

### Backend

- Node.js
- Express 5
- Multer untuk multipart file upload
- Swagger/OpenAPI documentation
- Supabase Postgres
- Gemini OCR melalui `@google/generative-ai`

## Setup Environment

### Backend

Buat file env lokal dari contoh:

```bash
cd backend
cp .env.example .env
```

Isi `backend/.env`:

```env
PORT=4000
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
CORS_ORIGIN=http://localhost:3000
```

Jangan expose `SUPABASE_SERVICE_ROLE_KEY` ke frontend.

### Frontend

Buat file env lokal dari contoh:

```bash
cd frontend
cp .env.example .env
```

Isi `frontend/.env`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

## Cara Menjalankan Lokal

Install dependency backend:

```bash
cd backend
npm install
```

Jalankan backend:

```bash
npm start
```

Install dependency frontend:

```bash
cd frontend
npm install
```

Jalankan frontend:

```bash
npm run dev
```

URL lokal:

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:3000` |
| Backend API | `http://localhost:4000/api` |
| Health Check | `http://localhost:4000/health` |
| Swagger UI | `http://localhost:4000/api-docs` |
| OpenAPI JSON | `http://localhost:4000/openapi.json` |

## Verifikasi

Backend:

```bash
cd backend
npm test
node -e "const app = require('./src/app'); console.log(typeof app)"
```

Frontend:

```bash
cd frontend
npm run typecheck
npm run build
```

Catatan: `npm test` di backend saat ini belum menjalankan automated test nyata.

## Batasan PoC

- `branch` OCR masih placeholder.
- OCR `bale` membutuhkan `GEMINI_API_KEY` yang valid.
- File upload saat ini disimpan sebagai base64 di Postgres untuk kemudahan PoC.
- Belum ada background worker; OCR diproses langsung saat endpoint extraction dipanggil.
- Belum ada authentication/authorization user-facing.
- Belum ada automated test coverage yang lengkap.

## Catatan untuk PM

Yang sudah bisa didemokan:

- Membuat case baru.
- Memilih channel intake.
- Upload dokumen sesuai channel.
- Menjalankan OCR untuk channel `bale`.
- Melihat hasil OCR dan field confidence.
- Mengedit hasil OCR secara manual.
- Melihat daftar case terbaru.

Yang masih perlu diputuskan untuk tahap berikutnya:

- Apakah `branch` akan memakai OCR template BTN block form sungguhan.
- Apakah file akan dipindahkan ke Supabase Storage/object storage.
- Apakah perlu role user, reviewer, dan audit approval flow.
- Apakah workflow akan diperluas ke appraisal properti, valuation, dan loan simulation.
- Apakah OCR perlu dipindahkan ke async job agar lebih stabil untuk file besar/banyak.
