-- Risk Desk Playbook V1 product view
-- Preserves the validated carry-forward methodology. No retuning and no synthesized confidence.

create or replace view public.riskdesk_product_playbook_v1
with (security_invoker = true)
as
select
  r.as_of_utc,
  r.regime_date,
  r.playbook,
  case
    when r.playbook = 'RISK_ON_DISINFLATIONARY_GOLDILOCKS' then 'GOLDILOCKS'
    when r.playbook = 'RISK_OFF_INFLATIONARY_STAGFLATION' then 'STAGFLATION'
    when r.playbook = 'RISK_OFF_DISINFLATIONARY_SLOWDOWN' then 'DISINFLATIONARY_RISK_OFF'
    when r.playbook = 'RISK_ON_INFLATIONARY_REFLATION' then 'REFLATION'
    else 'TRANSITION_OR_INSUFFICIENT'
  end as playbook_code,
  case
    when r.playbook = 'TRANSITION_OR_INSUFFICIENT' then 'INSUFFICIENT'
    when r.carry_forward is true then 'PARTIAL'
    else 'CONFIRMED'
  end as playbook_status,
  r.growth_score,
  r.inflation_score,
  r.growth_status,
  r.inflation_status,
  r.status as source_status,
  r.available_at,
  r.source_version,
  r.baseline_regime_date,
  r.baseline_dataset_regime,
  r.baseline_source,
  r.baseline_source_version,
  r.freshness_days,
  r.carry_forward,
  r.methodology_status,
  r.latest_relevant_release_utc,
  r.live_inputs_complete,
  r.context_only
from public.riskdesk_live_regime_latest_v1 r;

grant select on public.riskdesk_product_playbook_v1 to anon, authenticated;
