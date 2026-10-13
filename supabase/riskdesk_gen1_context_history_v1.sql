-- Risk Desk GEN1 event context persistence V1
-- Immutable event context published from RiskDesk_Nasdaq_GEN1_V13_Live.csv.
-- GEN1 remains historical/context only and never authorizes trading.

create table if not exists public.gen1_event_context_history (
  gen1_context_id bigint generated always as identity primary key,
  event_id text not null,
  event_ts_utc timestamptz not null,
  mode text not null check (mode in ('PRE_EVENT','POST_5M')),
  event_key text,
  event_package text,
  service_version text not null,
  service_state text,
  source_updated_at timestamptz,
  range_5_pts double precision,
  range_15_pts double precision,
  range_30_pts double precision,
  range_60_pts double precision,
  move_5_bps double precision,
  direction_5 integer,
  mfe_15_pts double precision,
  mfe_30_pts double precision,
  mfe_60_pts double precision,
  mae_15_pts double precision,
  mae_30_pts double precision,
  mae_60_pts double precision,
  pb50_prob double precision,
  pb70_prob double precision,
  rev100_prob double precision,
  pb50_pb70_conflict boolean,
  surprise_z_count integer,
  context_only boolean not null default true check (context_only = true),
  operational_authorized boolean not null default false check (operational_authorized = false),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (event_id, mode, service_version)
);

alter table public.gen1_event_context_history enable row level security;

drop policy if exists riskdesk_public_read_gen1_event_context_history
on public.gen1_event_context_history;

create policy riskdesk_public_read_gen1_event_context_history
on public.gen1_event_context_history
for select
to anon, authenticated
using (true);

revoke insert, update, delete, truncate, references, trigger
on public.gen1_event_context_history from anon, authenticated;

grant select on public.gen1_event_context_history to anon, authenticated;
grant select, insert on public.gen1_event_context_history to service_role;

create index if not exists idx_gen1_event_context_event_ts
on public.gen1_event_context_history (event_ts_utc desc);

create or replace view public.riskdesk_product_current_gen1_v1
with (security_invoker = true)
as
select g.*
from public.gen1_event_context_history g
join public.riskdesk_product_current_event_v1 e
  on e.event_id = g.event_id
order by case g.mode when 'POST_5M' then 0 else 1 end, g.created_at desc;

grant select on public.riskdesk_product_current_gen1_v1 to anon, authenticated;

create or replace view public.riskdesk_product_latest_gen1_v1
with (security_invoker = true)
as
select distinct on (g.mode) g.*
from public.gen1_event_context_history g
order by g.mode, g.event_ts_utc desc, g.created_at desc;

grant select on public.riskdesk_product_latest_gen1_v1 to anon, authenticated;
