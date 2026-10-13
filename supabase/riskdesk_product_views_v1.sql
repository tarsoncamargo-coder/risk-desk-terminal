-- Risk Desk Product Views V1
-- Additive/read-only product API views. Does not alter GEN1/GEN2/J11/Laranjinha.
-- Applied and verified against Supabase project risk-desk.

create or replace view public.riskdesk_product_next_event_v1
with (security_invoker = true)
as
select
  e.event_id,
  e.event_family,
  e.scheduled_ts_utc,
  e.status as source_status,
  case
    when e.scheduled_ts_utc <= now() + interval '60 minutes' then 'PRE_EVENT'
    else 'SCHEDULED'
  end as lifecycle,
  e.importance,
  e.reference,
  e.reference_date,
  e.unit,
  e.consensus,
  e.previous,
  e.revised,
  e.actual,
  e.official_surprise,
  e.surprise_status,
  e.schedule_source,
  e.actual_source,
  e.consensus_source,
  e.source,
  e.available_at,
  e.updated_at,
  extract(epoch from (e.scheduled_ts_utc - now())) / 60.0 as minutes_to_event
from public.live_event_state e
where e.scheduled_ts_utc >= now()
order by e.scheduled_ts_utc
limit 1;

create or replace view public.riskdesk_product_current_event_v1
with (security_invoker = true)
as
select
  e.event_id,
  e.event_family,
  e.scheduled_ts_utc,
  e.status as source_status,
  case
    when now() < e.scheduled_ts_utc then 'PRE_EVENT'
    when now() < e.scheduled_ts_utc + interval '1 minute' then 'RELEASE'
    when now() < e.scheduled_ts_utc + interval '5 minutes' then 'POST1'
    when now() < e.scheduled_ts_utc + interval '15 minutes' then 'POST5'
    when now() < e.scheduled_ts_utc + interval '30 minutes' then 'POST15'
    when now() < e.scheduled_ts_utc + interval '60 minutes' then 'POST30'
    else 'POST60'
  end as lifecycle,
  e.importance,
  e.reference,
  e.reference_date,
  e.unit,
  e.consensus,
  e.previous,
  e.revised,
  e.actual,
  e.official_surprise,
  e.surprise_status,
  e.schedule_source,
  e.actual_source,
  e.consensus_source,
  e.source,
  e.available_at,
  e.updated_at,
  extract(epoch from (now() - e.scheduled_ts_utc)) / 60.0 as event_age_minutes
from public.live_event_state e
where now() >= e.scheduled_ts_utc - interval '60 minutes'
  and now() <  e.scheduled_ts_utc + interval '90 minutes'
order by abs(extract(epoch from (now() - e.scheduled_ts_utc)))
limit 1;

create or replace view public.riskdesk_product_latest_released_event_v1
with (security_invoker = true)
as
select
  e.event_id,
  e.event_family,
  e.scheduled_ts_utc,
  e.status as source_status,
  'CLOSED'::text as lifecycle,
  e.importance,
  e.reference,
  e.reference_date,
  e.unit,
  e.consensus,
  e.previous,
  e.revised,
  e.actual,
  e.official_surprise,
  e.surprise_status,
  e.schedule_source,
  e.actual_source,
  e.consensus_source,
  e.source,
  e.available_at,
  e.updated_at
from public.live_event_state e
where e.scheduled_ts_utc < now()
  and (
    e.actual is not null
    or e.raw_actual is not null
    or e.status not in ('SCHEDULED','PRE_EVENT')
  )
order by e.scheduled_ts_utc desc
limit 1;

create or replace view public.riskdesk_product_current_event_components_v1
with (security_invoker = true)
as
select
  c.release_id,
  c.component_key,
  c.scheduled_ts_utc,
  c.event_name,
  c.ticker,
  c.importance,
  c.unit,
  c.actual,
  c.consensus,
  c.previous,
  c.revised,
  c.official_surprise,
  c.source,
  c.actual_source,
  c.consensus_source,
  c.surprise_status,
  c.last_update,
  c.received_at
from public.live_event_component c
join public.riskdesk_product_current_event_v1 e
  on e.scheduled_ts_utc = c.scheduled_ts_utc
order by c.component_key;

create or replace view public.riskdesk_product_system_health_v1
with (security_invoker = true)
as
select
  h.component,
  h.status,
  h.last_seen_utc,
  extract(epoch from (now() - h.last_seen_utc)) / 60.0 as age_minutes,
  h.source_version,
  h.details
from public.live_pipeline_heartbeat h
order by h.component;

grant select on public.riskdesk_product_next_event_v1 to anon, authenticated;
grant select on public.riskdesk_product_current_event_v1 to anon, authenticated;
grant select on public.riskdesk_product_latest_released_event_v1 to anon, authenticated;
grant select on public.riskdesk_product_current_event_components_v1 to anon, authenticated;
grant select on public.riskdesk_product_system_health_v1 to anon, authenticated;
