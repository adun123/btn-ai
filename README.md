# BTN AI - KPR House Assessment OCR Workflow

BTN AI is a proof-of-concept application for a KPR house assessment workflow. It combines a Next.js frontend with an Express backend for case creation, property location capture, document upload, and OCR extraction for mortgage onboarding documents.

The project currently supports two intake channels:

- `bale` - digital/mobile-style document intake for KTP, KK, salary slip, NPWP, and bank statement documents.
- `branch` - branch-assisted intake with a placeholder BTN block-form OCR pipeline.

## Project Filepath Tree

Generated/build folders such as `node_modules/` and `.next/` are intentionally omitted.

```text
btn-ai/
├── README.md
├── .gitignore
├── api/
│   └── <empty root API placeholder>
├── backend/
│   ├── README.md
│   ├── .env.example
│   ├── package.json
│   ├── package-lock.json
│   ├── api/
│   │   └── index.js
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── data/
│   │   │   ├── case-mappers.js
│   │   │   └── supabase.js
│   │   ├── middlewares/
│   │   │   └── errorHandler.js
│   │   ├── modules/
│   │   │   ├── assessment-core/
│   │   │   │   ├── case.repository.js
│   │   │   │   ├── case.routes.js
│   │   │   │   └── case.service.js
│   │   │   ├── evidence-documents/
│   │   │   │   ├── evidence.repository.js
│   │   │   │   ├── evidence.routes.js
│   │   │   │   └── evidence.service.js
│   │   │   ├── extraction/
│   │   │   │   ├── extraction.routes.js
│   │   │   │   └── extraction.service.js
│   │   │   ├── health/
│   │   │   │   └── health.routes.js
│   │   │   ├── property-location/
│   │   │   │   ├── location.routes.js
│   │   │   │   └── location.service.js
│   │   │   └── provider-gateway/
│   │   │       └── gemini-ocr.service.js
│   │   ├── openapi/
│   │   │   └── spec.js
│   │   └── utils/
│   │       ├── caseFactory.js
│   │       ├── clientCaseSnapshot.js
│   │       └── httpError.js
│   └── supabase/
│       └── migrations/
│           └── 20260504_init_btn_assessment_persistence.sql
├── docs/
│   ├── 2026-04-29-arch-house-collateral-assessment-blueprint.md
│   ├── 2026-04-29-arch-house-collateral-assessment-blueprint.docx
│   ├── 2026-04-29-arch-house-collateral-assessment-blueprint.pdf
│   ├── FORM-KPR-BTN.pdf
│   ├── pdf-print.css
│   └── doc test/
└── frontend/
    ├── .env.example
    ├── package.json
    ├── package-lock.json
    ├── next.config.ts
    ├── postcss.config.mjs
    ├── tsconfig.json
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.module.css
    │   └── page.tsx
    ├── components/
    │   ├── backend-status.module.css
    │   ├── backend-status.tsx
    │   ├── providers/
    │   │   └── query-provider.tsx
    │   └── workflow/
    │       ├── ocr-workflow-page.tsx
    │       ├── stepper.tsx
    │       ├── summary-panel.tsx
    │       └── steps/
    ├── lib/
    │   ├── api.ts
    │   ├── document-labels.ts
    │   └── workflow.ts
    ├── store/
    │   └── workflow-store.ts
    └── types/
        └── ocr.ts
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
- Multer for multipart file uploads
- Swagger/OpenAPI documentation
- Supabase Postgres persistence
- Gemini OCR through `@google/generative-ai`

## Prerequisites

Install these before running the project:

- Node.js 20 or newer
- npm
- Supabase project credentials
- Gemini API key for Bale OCR extraction

## Environment Setup

Create local environment files from the examples.

### Backend

```bash
cd backend
cp .env.example .env
```

Fill in `backend/.env`:

```env
PORT=4000
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
CORS_ORIGIN=http://localhost:3000
```

Use the Supabase service role key only on the backend. Do not expose it in the frontend.

### Frontend

```bash
cd frontend
cp .env.example .env
```

Fill in `frontend/.env`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

## Supabase Database Setup

The connected Supabase project has already been migrated through MCP. The tracked schema snapshot is available at:

```text
backend/supabase/migrations/20260504_init_btn_assessment_persistence.sql
```

Current database tables:

- `public.cases`
- `public.evidence_documents`

Both tables have Row Level Security enabled. The backend is expected to access them using `SUPABASE_SERVICE_ROLE_KEY`.

For this PoC, uploaded file payloads are stored as base64 in Postgres. A production-ready version should move binary files to Supabase Storage and keep only metadata/database references in Postgres.

## Installation

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

## Running Locally

Start the backend API:

```bash
cd backend
npm start
```

Backend URLs:

- API base: `http://localhost:4000/api`
- Health check: `http://localhost:4000/health`
- Swagger UI: `http://localhost:4000/api-docs`
- OpenAPI JSON: `http://localhost:4000/openapi.json`

Start the frontend app in another terminal:

```bash
cd frontend
npm run dev
```

Frontend URL:

```text
http://localhost:3000
```

## Main Workflow

1. Create an assessment case.
2. Save property location details.
3. Upload required documents.
4. Start OCR extraction.
5. Review extracted OCR fields.

Main backend endpoints:

```text
GET  /health
POST /api/cases
GET  /api/cases
GET  /api/cases/:caseId
PATCH /api/cases/:caseId
POST /api/cases/:caseId/status
POST /api/cases/:caseId/location
POST /api/cases/:caseId/evidence
GET  /api/cases/:caseId/evidence
POST /api/cases/:caseId/extraction/start
GET  /api/cases/:caseId/extraction
```

## Verification Commands

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

## Notes for Development

- The `branch` channel still uses a placeholder extraction response.
- The `bale` channel calls Gemini OCR and requires `GEMINI_API_KEY`.
- Supabase credentials are backend-only secrets.
- Keep generated folders such as `node_modules/`, `.next/`, and `tsconfig.tsbuildinfo` out of documentation and commits unless intentionally needed.
