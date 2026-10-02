-- Supabase SQL Editor에서 실행 (Vercel 배포용)

create table if not exists parse_batches (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  raw_text_preview text
);

create table if not exists fluid_usage (
  id bigint generated always as identity primary key,
  batch_id bigint references parse_batches(id),
  service_date date,
  item_name text not null,
  quantity double precision not null default 0,
  unit text,
  status text not null default 'approved',
  source_line text,
  created_at timestamptz not null default now()
);

create table if not exists injection_records (
  id bigint generated always as identity primary key,
  batch_id bigint references parse_batches(id),
  service_date date,
  patient_name text,
  equipment text,
  chart_no text,
  room_no integer,
  detail text,
  incentive_amount integer not null default 0,
  status text not null default 'approved',
  created_at timestamptz not null default now()
);

create table if not exists safety_stock (
  item_name text primary key,
  min_quantity double precision not null default 0
);

create index if not exists idx_fluid_date on fluid_usage(service_date);
create index if not exists idx_injection_date on injection_records(service_date);
create index if not exists idx_injection_room on injection_records(room_no);
