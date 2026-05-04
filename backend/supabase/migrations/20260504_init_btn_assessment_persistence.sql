create extension if not exists pgcrypto;

create table public.cases (
  id uuid primary key,
  reference_number text not null,
  channel text not null check (channel in ('branch', 'bale')),
  status text not null,
  applicant jsonb not null default '{}'::jsonb,
  property jsonb not null default '{}'::jsonb,
  notes text not null default '',
  location jsonb,
  extraction jsonb,
  manual_extraction_edits jsonb not null default '{}'::jsonb,
  audit_trail jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.evidence_documents (
  id uuid primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  document_type text not null,
  filename text not null,
  mimetype text not null,
  size integer not null check (size >= 0),
  notes text not null default '',
  uploaded_at timestamptz not null default timezone('utc', now()),
  base64_data text not null,
  mime_type text not null
);

create index evidence_documents_case_id_idx on public.evidence_documents(case_id);
create index evidence_documents_uploaded_at_idx on public.evidence_documents(uploaded_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger cases_set_updated_at
before update on public.cases
for each row
execute function public.set_updated_at();

alter table public.cases enable row level security;
alter table public.evidence_documents enable row level security;
