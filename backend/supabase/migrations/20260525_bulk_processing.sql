-- Bulk OCR processing tables

create table public.bulk_jobs (
  id uuid primary key,
  status text not null default 'pending' check (status in ('pending', 'extracting', 'ocr_processing', 'classifying', 'grouping', 'completed', 'failed')),
  upload_type text not null check (upload_type in ('zip', 'bulk_files')),
  total_files integer not null default 0,
  total_pages integer not null default 0,
  processed_pages integer not null default 0,
  batch_count integer not null default 0,
  batch_size integer not null default 20,
  error text,
  result jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create table public.bulk_pages (
  id uuid primary key,
  job_id uuid not null references public.bulk_jobs(id) on delete cascade,
  source_filename text not null,
  page_number integer not null,
  batch_index integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  ocr_text text,
  ocr_confidence real,
  ocr_raw jsonb,
  error text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.bulk_documents (
  id uuid primary key,
  job_id uuid not null references public.bulk_jobs(id) on delete cascade,
  document_type text not null,
  confidence real not null default 0,
  source_filename text not null,
  page_ids uuid[] not null default '{}',
  extracted_fields jsonb not null default '{}'::jsonb,
  classification_method text not null default 'rule_based',
  nasabah_id uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.bulk_nasabah (
  id uuid primary key,
  job_id uuid not null references public.bulk_jobs(id) on delete cascade,
  full_name text,
  nik text,
  address text,
  document_ids uuid[] not null default '{}',
  completeness jsonb not null default '{}'::jsonb,
  completeness_score real not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index bulk_pages_job_id_idx on public.bulk_pages(job_id);
create index bulk_pages_batch_idx on public.bulk_pages(job_id, batch_index);
create index bulk_documents_job_id_idx on public.bulk_documents(job_id);
create index bulk_documents_nasabah_id_idx on public.bulk_documents(nasabah_id);
create index bulk_nasabah_job_id_idx on public.bulk_nasabah(job_id);
create index bulk_nasabah_nik_idx on public.bulk_nasabah(nik);

create trigger bulk_jobs_set_updated_at
before update on public.bulk_jobs
for each row
execute function public.set_updated_at();

alter table public.bulk_jobs enable row level security;
alter table public.bulk_pages enable row level security;
alter table public.bulk_documents enable row level security;
alter table public.bulk_nasabah enable row level security;
