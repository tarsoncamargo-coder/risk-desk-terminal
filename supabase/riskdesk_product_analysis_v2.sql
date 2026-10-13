-- Risk Desk Analysis V2
-- Adds deterministic cross-asset and related-event context to the existing structured analysis.

create or replace view public.riskdesk_product_analysis_v2
with (security_invoker = true)
as
with matrix as (
  select
    event_id,
    count(*) filter (where layer_key <> 'EVENT' and alignment='ALIGNED') as aligned_count,
    count(*) filter (where layer_key <> 'EVENT' and alignment='CONTRARY') as contrary_count,
    count(*) filter (where layer_key <> 'EVENT' and alignment='NEUTRAL') as neutral_count,
    count(*) filter (where layer_key <> 'EVENT' and alignment in ('ALIGNED','CONTRARY','NEUTRAL')) as usable_count
  from public.riskdesk_product_directional_matrix_v1
  group by event_id
),
related as (
  select
    target_event_id as event_id,
    count(*) filter (where availability_status='READY') as ready_count,
    count(*) filter (where alignment='ALIGNED') as aligned_count,
    count(*) filter (where alignment='CONTRARY') as contrary_count,
    count(*) filter (where alignment='NEUTRAL') as neutral_count,
    string_agg(
      related_family || ': ' ||
      case alignment
        when 'ALIGNED' then 'A FAVOR'
        when 'CONTRARY' then 'CONTRA'
        when 'NEUTRAL' then 'NEUTRO'
        else 'SEM LEITURA'
      end,
      ' | ' order by priority
    ) filter (where availability_status='READY') as related_summary
  from public.riskdesk_product_related_events_v1
  group by target_event_id
)
select
  a.*,
  case
    when coalesce(m.usable_count,0)=0
      then 'Cross-asset: aguardando dados atuais e semantica do evento.'
    else concat(
      'Cross-asset: ',coalesce(m.aligned_count,0),' a favor, ',
      coalesce(m.contrary_count,0),' contra, ',
      coalesce(m.neutral_count,0),' neutro.'
    )
  end as cross_asset_reason,
  case
    when coalesce(r.ready_count,0)=0
      then 'Eventos relacionados: ainda sem release + leitura semantica validada.'
    else concat('Eventos relacionados: ',coalesce(r.related_summary,'sem leitura'),'.')
  end as related_event_reason,
  coalesce(m.aligned_count,0) as cross_asset_aligned_count,
  coalesce(m.contrary_count,0) as cross_asset_contrary_count,
  coalesce(m.neutral_count,0) as cross_asset_neutral_count,
  coalesce(r.ready_count,0) as related_event_ready_count,
  coalesce(r.aligned_count,0) as related_event_aligned_count,
  coalesce(r.contrary_count,0) as related_event_contrary_count,
  'V2_STRUCTURED_PLUS_DIRECTIONAL_MATRIX'::text as analysis_methodology
from public.riskdesk_product_analysis_v1 a
left join matrix m on m.event_id=a.event_id
left join related r on r.event_id=a.event_id;

grant select on public.riskdesk_product_analysis_v2 to anon, authenticated;
