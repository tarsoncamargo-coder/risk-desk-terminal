-- Risk Desk Product Market State V2 V1
-- Read-only presentation contract over the already validated live Market State layer.
-- No new score, no Market-Implied Surprise, no trade authorization.

create or replace view public.riskdesk_product_market_state_v2_v1
with (security_invoker = true)
as
with target as (
  select event_id, 'CURRENT'::text as event_role
  from public.riskdesk_product_current_event_v1
  union all
  select event_id, 'NEXT'::text as event_role
  from public.riskdesk_product_next_event_v1
  where not exists (select 1 from public.riskdesk_product_current_event_v1)
)
select
  m.event_id,
  t.event_role,
  m.event_ts_utc,
  m.as_of_utc,
  m."window",
  m.window_status,
  m.market_state as market_state_raw,
  m.data_status,
  m.cross_asset_signature,
  m.nq_raw_pct,
  m.zq_raw_pct,
  m.zt_raw_pct,
  m.zn_raw_pct,
  m.dxy_raw_pct,
  m.nq_oriented,
  m.zq_oriented,
  m.zt_oriented,
  m.zn_oriented,
  m.dxy_oriented,
  m.policy_reading,
  m.rates_2y_reading,
  m.rates_10y_reading,
  m.risk_reading,
  m.dollar_reading,
  m.sigma_reading,
  m.sigma_z,
  m.regime_reading,
  m.regime_status,
  m.missing_assets,
  m.active_factors,
  m.context_only,
  m.composite_authorized,
  m.trade_signal_authorized,
  case
    when m.window_status = 'WAITING' or m.data_status = 'WAITING' then 'WAITING'
    when m.data_status in ('STALE','STALE_OR_UNAVAILABLE') then 'STALE'
    when m.market_state in ('RISK_ON','RISK_OFF','MIXED','NEUTRAL') then m.market_state
    when m.market_state is null then 'UNAVAILABLE'
    else m.market_state
  end as market_state_v2,
  case
    when m.window_status = 'WAITING' or m.data_status = 'WAITING' then 'AGUARDANDO_JANELA'
    when m.data_status in ('STALE','STALE_OR_UNAVAILABLE') then 'DADOS_DESATUALIZADOS_OU_INDISPONIVEIS'
    when m.market_state is null then 'SEM_LEITURA'
    else 'LEITURA_DISPONIVEL'
  end as product_status,
  'UNDETERMINED'::text as event_semantic_alignment,
  false::boolean as operational_authorized
from public.riskdesk_live_market_state_latest_v1 m
join target t on t.event_id = m.event_id
order by
  case m."window"
    when 'LIVE' then 0
    when 'PRE5' then 1
    when 'PRE15' then 2
    when 'PRE30' then 3
    when 'PRE60' then 4
    when 'PRE240' then 5
    when 'PRE1440' then 6
    else 99
  end;

grant select on public.riskdesk_product_market_state_v2_v1 to anon, authenticated;
