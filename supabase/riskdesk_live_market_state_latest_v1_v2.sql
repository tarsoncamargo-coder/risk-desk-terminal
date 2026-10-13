-- Extend the latest live Market State view with volatility context.
create or replace view public.riskdesk_live_market_state_latest_v1
with (security_invoker = true)
as
select distinct on ("window")
  as_of_utc,
  event_id,
  "window",
  nq_oriented,
  zq_oriented,
  zt_oriented,
  zn_oriented,
  dxy_oriented,
  macro_score,
  active_factors,
  market_state,
  context_only,
  source_version,
  event_ts_utc,
  baseline_ts_utc,
  endpoint_ts_utc,
  window_status,
  nq_raw_pct,
  zq_raw_pct,
  zt_raw_pct,
  zn_raw_pct,
  dxy_raw_pct,
  policy_reading,
  rates_2y_reading,
  rates_10y_reading,
  risk_reading,
  dollar_reading,
  sigma_reading,
  sigma_z,
  cross_asset_signature,
  data_status,
  missing_assets,
  composite_authorized,
  trade_signal_authorized,
  regime_reading,
  regime_status,
  vix_raw_pct,
  vxn_raw_pct,
  vix_reading,
  vxn_reading
from public.live_market_state
order by "window", as_of_utc desc;

grant select on public.riskdesk_live_market_state_latest_v1 to anon, authenticated;
