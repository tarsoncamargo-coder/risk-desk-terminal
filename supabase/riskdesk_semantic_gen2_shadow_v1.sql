-- Risk Desk Semantic + GEN2 Shadow persistence V1
-- Additive schema for J11/J12 publication. No training, retuning, trade signal or Laranjinha changes.

create table if not exists public.live_event_semantic_state (
  event_id text primary key,
  event_ts_utc timestamptz not null,
  family text,
  stance_bundle text,
  conflito_semantico boolean,
  pressao_monetaria_z_mean double precision,
  pressao_dominante_z double precision,
  qtd_hawkish integer not null default 0 check (qtd_hawkish >= 0),
  qtd_dovish integer not null default 0 check (qtd_dovish >= 0),
  qtd_neutral integer not null default 0 check (qtd_neutral >= 0),
  qtd_componentes_z_semanticos integer not null default 0 check (qtd_componentes_z_semanticos >= 0),
  mapping_complete boolean not null default false,
  unmapped_keys text[] not null default '{}',
  blocked_keys text[] not null default '{}',
  prospective_fresh boolean not null default false,
  observation_class text,
  data_quality text,
  feature_builder_version text,
  source_version text not null,
  context_only boolean not null default true,
  trade_signal_authorized boolean not null default false check (trade_signal_authorized = false),
  operational_authorized boolean not null default false check (operational_authorized = false),
  updated_at timestamptz not null default now()
);

alter table public.live_event_semantic_state enable row level security;

drop policy if exists riskdesk_public_read_live_event_semantic_state on public.live_event_semantic_state;
create policy riskdesk_public_read_live_event_semantic_state
on public.live_event_semantic_state
for select
to anon, authenticated
using (true);

revoke insert, update, delete, truncate, references, trigger
on public.live_event_semantic_state from anon, authenticated;
grant select on public.live_event_semantic_state to anon, authenticated;
grant select, insert, update on public.live_event_semantic_state to service_role;

create table if not exists public.gen2_shadow_prediction_history (
  prediction_id bigint generated always as identity primary key,
  event_id text not null,
  event_ts_utc timestamptz not null,
  prediction_ts_utc timestamptz not null default now(),
  stage text not null default 'POST5',
  horizon_minutes integer not null default 60 check (horizon_minutes > 0),
  p_up_raw double precision check (p_up_raw is null or (p_up_raw >= 0 and p_up_raw <= 1)),
  p_up_isotonic double precision check (p_up_isotonic is null or (p_up_isotonic >= 0 and p_up_isotonic <= 1)),
  direction_shadow text,
  family text,
  prediction_source text,
  model_name text not null default 'HGB',
  model_version text not null,
  feature_builder_version text not null,
  prospective_fresh boolean not null default false,
  feature_schema_complete boolean not null default false,
  data_quality text,
  shadow_only boolean not null default true check (shadow_only = true),
  probability_of_profit boolean not null default false check (probability_of_profit = false),
  trade_signal boolean not null default false check (trade_signal = false),
  entry_filter boolean not null default false check (entry_filter = false),
  operational_authorized boolean not null default false check (operational_authorized = false),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (event_id, model_version, feature_builder_version, stage, horizon_minutes)
);

alter table public.gen2_shadow_prediction_history enable row level security;

drop policy if exists riskdesk_public_read_gen2_shadow_prediction_history on public.gen2_shadow_prediction_history;
create policy riskdesk_public_read_gen2_shadow_prediction_history
on public.gen2_shadow_prediction_history
for select
to anon, authenticated
using (true);

revoke insert, update, delete, truncate, references, trigger
on public.gen2_shadow_prediction_history from anon, authenticated;
grant select on public.gen2_shadow_prediction_history to anon, authenticated;
grant select, insert on public.gen2_shadow_prediction_history to service_role;

create index if not exists idx_gen2_shadow_prediction_event_ts
on public.gen2_shadow_prediction_history (event_ts_utc desc);

create or replace view public.riskdesk_product_current_semantic_v1
with (security_invoker = true)
as
select s.*
from public.live_event_semantic_state s
join public.riskdesk_product_current_event_v1 e
  on e.event_id = s.event_id;

create or replace view public.riskdesk_product_current_gen2_shadow_v1
with (security_invoker = true)
as
select p.*
from public.gen2_shadow_prediction_history p
join public.riskdesk_product_current_event_v1 e
  on e.event_id = p.event_id
order by p.prediction_ts_utc desc
limit 1;

create or replace view public.riskdesk_product_latest_gen2_shadow_v1
with (security_invoker = true)
as
select p.*
from public.gen2_shadow_prediction_history p
order by p.prediction_ts_utc desc
limit 1;

grant select on public.riskdesk_product_current_semantic_v1 to anon, authenticated;
grant select on public.riskdesk_product_current_gen2_shadow_v1 to anon, authenticated;
grant select on public.riskdesk_product_latest_gen2_shadow_v1 to anon, authenticated;
