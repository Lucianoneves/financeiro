create table anticipations (
  id uuid primary key default gen_random_uuid(),
  bank_account_ref text not null,
  anticipation_date date not null,
  monthly_rate_percent numeric(7,4) not null check (monthly_rate_percent >= 0),
  gross_cents bigint not null check (gross_cents > 0),
  interest_cents bigint not null check (interest_cents >= 0),
  fee_cents bigint not null check (fee_cents >= 0),
  net_cents bigint not null check (net_cents >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'posted', 'partially_settled', 'settled', 'failed')),
  erp_entry_ids jsonb not null default '{}'::jsonb,
  last_error text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table anticipated_receivables (
  id uuid primary key default gen_random_uuid(),
  anticipation_id uuid not null references anticipations (id) on delete cascade,
  -- único: impede antecipar o mesmo título duas vezes
  erp_receivable_id text not null unique,
  customer text not null,
  document_number text not null,
  due_date date not null,
  face_cents bigint not null check (face_cents > 0),
  interest_cents bigint not null check (interest_cents >= 0),
  status text not null default 'anticipated'
    check (status in ('anticipated', 'settled', 'defaulted')),
  settled_at date
);

create index on anticipated_receivables (anticipation_id);
create index on anticipated_receivables (status);

create table erp_sync_log (
  id bigint generated always as identity primary key,
  idempotency_key text not null,
  operation text not null,
  payload jsonb not null,
  ok boolean not null,
  error text,
  created_at timestamptz not null default now()
);

create index on erp_sync_log (idempotency_key);

alter table anticipations enable row level security;
alter table anticipated_receivables enable row level security;
alter table erp_sync_log enable row level security;

-- Usuários autenticados leem; escritas passam pelo service role (Server Actions / cron).
create policy "authenticated read anticipations" on anticipations
  for select to authenticated using (true);
create policy "authenticated read anticipated_receivables" on anticipated_receivables
  for select to authenticated using (true);
create policy "authenticated read erp_sync_log" on erp_sync_log
  for select to authenticated using (true);
