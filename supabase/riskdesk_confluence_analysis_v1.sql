-- Risk Desk Confluence V1 + deterministic Risk Desk Analysis
-- Methodology: state machine, no weighted score, no probability of profit.
-- Independent directional layers: Market State V2, structural Playbook, GEN2 Shadow.
-- Event semantics and GEN1 remain context/risk modifiers; cross-asset is already inside Market State and is not double-counted.

create or replace view public.riskdesk_product_confluence_v1
with (security_invoker = true)
as
with target as (
  select event_id, event_family, scheduled_ts_utc, lifecycle, 'CURRENT'::text as event_role
  from public.riskdesk_product_current_event_v1
  union all
  select event_id, event_family, scheduled_ts_utc, lifecycle, 'NEXT'::text as event_role
  from public.riskdesk_product_next_event_v1
  where not exists (select 1 from public.riskdesk_product_current_event_v1)
),
base as (
  select
    t.event_id, t.event_family, t.scheduled_ts_utc, t.lifecycle, t.event_role,
    s.stance_bundle, s.conflito_semantico,
    s.data_quality as semantic_data_quality,
    s.prospective_fresh as semantic_prospective_fresh,
    mv."window" as market_window,
    mv.market_state_v2,
    mv.product_status as market_product_status,
    mv.cross_asset_signature,
    mv.data_status as market_data_status,
    p.playbook_code,
    p.playbook_status,
    p.carry_forward as playbook_carry_forward,
    g2.direction_shadow as gen2_direction_shadow,
    g2.p_up_isotonic,
    g2.prediction_source as gen2_prediction_source,
    g2.prospective_fresh as gen2_prospective_fresh,
    g2.shadow_only as gen2_shadow_only,
    g1.mode as gen1_mode,
    g1.range_15_pts as gen1_range_15_pts,
    g1.range_30_pts as gen1_range_30_pts,
    g1.range_60_pts as gen1_range_60_pts,
    g1.mfe_15_pts as gen1_mfe_15_pts,
    g1.mfe_30_pts as gen1_mfe_30_pts,
    g1.mfe_60_pts as gen1_mfe_60_pts,
    g1.mae_15_pts as gen1_mae_15_pts,
    g1.mae_30_pts as gen1_mae_30_pts,
    g1.mae_60_pts as gen1_mae_60_pts,
    g1.pb50_prob as gen1_pb50_prob,
    g1.pb70_prob as gen1_pb70_prob,
    g1.rev100_prob as gen1_rev100_prob,
    g1.pb50_pb70_conflict as gen1_pb_conflict,
    case
      when mv.product_status = 'LEITURA_DISPONIVEL' and mv.market_state_v2 = 'RISK_ON' then 'UP'
      when mv.product_status = 'LEITURA_DISPONIVEL' and mv.market_state_v2 = 'RISK_OFF' then 'DOWN'
      else null
    end as market_direction,
    case
      when p.playbook_code in ('GOLDILOCKS','REFLATION')
       and p.playbook_status in ('CONFIRMED','PARTIAL') then 'UP'
      when p.playbook_code in ('STAGFLATION','DISINFLATIONARY_RISK_OFF')
       and p.playbook_status in ('CONFIRMED','PARTIAL') then 'DOWN'
      else null
    end as playbook_direction,
    case
      when g2.prospective_fresh is true and g2.shadow_only is true
       and upper(coalesce(g2.direction_shadow,'')) in ('ALTA','UP','HIGH') then 'UP'
      when g2.prospective_fresh is true and g2.shadow_only is true
       and upper(coalesce(g2.direction_shadow,'')) in ('BAIXA','DOWN','LOW') then 'DOWN'
      else null
    end as gen2_direction
  from target t
  left join public.live_event_semantic_state s on s.event_id = t.event_id
  left join lateral (
    select m.*
    from public.riskdesk_product_market_state_v2_v1 m
    where m.event_id = t.event_id
    order by
      case
        when m.product_status = 'LEITURA_DISPONIVEL' and m."window" = 'LIVE' then 0
        when m.product_status = 'LEITURA_DISPONIVEL' and m."window" = 'PRE5' then 1
        when m.product_status = 'LEITURA_DISPONIVEL' and m."window" = 'PRE15' then 2
        when m.product_status = 'LEITURA_DISPONIVEL' and m."window" = 'PRE30' then 3
        when m.product_status = 'LEITURA_DISPONIVEL' and m."window" = 'PRE60' then 4
        when m.product_status = 'LEITURA_DISPONIVEL' then 5
        when m."window" = 'LIVE' then 6
        when m."window" = 'PRE5' then 7
        when m."window" = 'PRE15' then 8
        when m."window" = 'PRE30' then 9
        when m."window" = 'PRE60' then 10
        else 99
      end,
      m.as_of_utc desc
    limit 1
  ) mv on true
  left join public.riskdesk_product_playbook_v1 p on true
  left join lateral (
    select x.*
    from public.gen2_shadow_prediction_history x
    where x.event_id = t.event_id
    order by x.prediction_ts_utc desc
    limit 1
  ) g2 on true
  left join lateral (
    select x.*
    from public.gen1_event_context_history x
    where x.event_id = t.event_id
    order by case x.mode when 'POST_5M' then 0 else 1 end, x.created_at desc
    limit 1
  ) g1 on true
),
counts as (
  select
    b.*,
    ((market_direction is not null)::int
     + (playbook_direction is not null)::int
     + (gen2_direction is not null)::int) as directional_layers_available,
    (coalesce((market_direction = 'UP')::int,0)
     + coalesce((playbook_direction = 'UP')::int,0)
     + coalesce((gen2_direction = 'UP')::int,0)) as up_layers,
    (coalesce((market_direction = 'DOWN')::int,0)
     + coalesce((playbook_direction = 'DOWN')::int,0)
     + coalesce((gen2_direction = 'DOWN')::int,0)) as down_layers
  from base b
),
classified as (
  select
    c.*,
    case
      when up_layers > 0 and down_layers > 0 then 'CONFLICT'
      when directional_layers_available = 3 then 'HIGH'
      when directional_layers_available = 2 then 'MODERATE'
      when directional_layers_available = 1 then 'LOW'
      else 'INDETERMINATE'
    end as base_confluence_level,
    case
      when up_layers > 0 and down_layers = 0 then 'UP'
      when down_layers > 0 and up_layers = 0 then 'DOWN'
      else 'NONE'
    end as directional_bias
  from counts c
)
select
  x.event_id, x.event_family, x.scheduled_ts_utc, x.lifecycle, x.event_role,
  x.stance_bundle as event_stance,
  case
    when x.stance_bundle is null then 'UNAVAILABLE'
    when coalesce(x.conflito_semantico,false) is true
      or upper(coalesce(x.stance_bundle,'')) = 'MIXED' then 'SEMANTIC_CONFLICT'
    else 'CONTEXT_ONLY'
  end as event_alignment,
  x.market_state_v2, x.market_window, x.market_product_status, x.market_direction,
  x.cross_asset_signature,
  case when x.market_direction is null then 'UNAVAILABLE' else 'DIRECTIONAL_INPUT' end as market_alignment,
  x.playbook_code, x.playbook_status, x.playbook_direction,
  case when x.playbook_direction is null then 'CONTEXT_ONLY' else 'DIRECTIONAL_INPUT' end as playbook_alignment,
  x.gen2_direction_shadow, x.p_up_isotonic, x.gen2_prediction_source, x.gen2_direction,
  case when x.gen2_direction is null then 'UNAVAILABLE' else 'DIRECTIONAL_INPUT' end as gen2_alignment,
  x.gen1_mode,
  x.gen1_range_15_pts, x.gen1_range_30_pts, x.gen1_range_60_pts,
  x.gen1_mfe_15_pts, x.gen1_mfe_30_pts, x.gen1_mfe_60_pts,
  x.gen1_mae_15_pts, x.gen1_mae_30_pts, x.gen1_mae_60_pts,
  x.gen1_pb50_prob, x.gen1_pb70_prob, x.gen1_rev100_prob, x.gen1_pb_conflict,
  case
    when x.gen1_mode is null then 'UNAVAILABLE'
    when coalesce(x.gen1_pb_conflict,false) is true then 'RISK_CONFLICT'
    else 'CONTEXT_ONLY'
  end as gen1_alignment,
  'INCLUDED_INSIDE_MARKET_STATE'::text as cross_asset_alignment,
  false::boolean as cross_asset_counted_twice,
  x.directional_layers_available, x.up_layers, x.down_layers,
  x.directional_bias as direction,
  case
    when x.base_confluence_level = 'HIGH'
      and (
        coalesce(x.conflito_semantico,false) is true
        or upper(coalesce(x.stance_bundle,'')) = 'MIXED'
        or coalesce(x.gen1_pb_conflict,false) is true
        or coalesce(x.playbook_status,'INSUFFICIENT') <> 'CONFIRMED'
      ) then 'MODERATE'
    else x.base_confluence_level
  end as confluence_level,
  case
    when x.directional_layers_available = 3 then 'FULL'
    when x.directional_layers_available = 2 then 'PARTIAL'
    when x.directional_layers_available = 1 then 'MINIMAL'
    else 'NONE'
  end as evidence_coverage,
  false::boolean as probability_of_profit,
  false::boolean as trade_signal,
  false::boolean as entry_filter,
  false::boolean as operational_authorized,
  'V1_STATE_MACHINE_NO_WEIGHTED_SCORE'::text as methodology
from classified x;

grant select on public.riskdesk_product_confluence_v1 to anon, authenticated;

create or replace view public.riskdesk_product_analysis_v1
with (security_invoker = true)
as
select
  c.*,
  case
    when c.confluence_level = 'HIGH' and c.direction = 'UP'
      then 'Confluencia alta para alta: as camadas direcionais validas estao alinhadas.'
    when c.confluence_level = 'HIGH' and c.direction = 'DOWN'
      then 'Confluencia alta para baixa: as camadas direcionais validas estao alinhadas.'
    when c.confluence_level = 'MODERATE' and c.direction = 'UP'
      then 'Confluencia moderada para alta: ha alinhamento parcial sem oposicao direcional valida.'
    when c.confluence_level = 'MODERATE' and c.direction = 'DOWN'
      then 'Confluencia moderada para baixa: ha alinhamento parcial sem oposicao direcional valida.'
    when c.confluence_level = 'LOW' and c.direction in ('UP','DOWN')
      then 'Confluencia baixa: apenas uma camada direcional valida esta disponivel.'
    when c.confluence_level = 'CONFLICT'
      then 'Conflito: as camadas direcionais validas apontam para lados opostos.'
    else 'Indeterminado: faltam camadas direcionais validas ou os dados ainda estao aguardando.'
  end as summary,
  case
    when c.event_stance is null then 'Evento: sem leitura semantica disponivel.'
    when c.event_alignment = 'SEMANTIC_CONFLICT'
      then concat('Evento: ', c.event_stance, ' com conflito semantico entre componentes.')
    else concat('Evento: ', c.event_stance, '.')
  end as macro_reason,
  case
    when c.market_state_v2 is null then 'Market State: indisponivel.'
    else concat('Market State: ', c.market_state_v2,
      coalesce(concat(' (', c.market_window, ')'), ''),
      '. Status: ', coalesce(c.market_product_status,'UNAVAILABLE'), '.')
  end as market_reason,
  concat('Playbook: ', coalesce(c.playbook_code,'UNAVAILABLE'),
    '. Estado: ', coalesce(c.playbook_status,'UNAVAILABLE'), '.') as playbook_reason,
  case
    when c.gen2_direction_shadow is null then 'GEN2: aguardando previsao prospectiva POST5.'
    else concat('GEN2: ', c.gen2_direction_shadow,
      case when c.p_up_isotonic is not null
        then concat(' | P(ALTA | MOVIMENTO RELEVANTE)=',
          round((c.p_up_isotonic * 100)::numeric,1), '%')
        else '' end, '.')
  end as model_reason,
  case
    when c.gen1_mode is null then 'GEN1: aguardando contexto live do evento.'
    when c.gen1_mode = 'POST_5M' then concat(
      'GEN1 POST5: range 15/30/60 = ',
      coalesce(round(c.gen1_range_15_pts::numeric,1)::text,'--'), '/',
      coalesce(round(c.gen1_range_30_pts::numeric,1)::text,'--'), '/',
      coalesce(round(c.gen1_range_60_pts::numeric,1)::text,'--'),
      ' pts; REV100 = ', coalesce(round(c.gen1_rev100_prob::numeric,1)::text,'--'), '%.')
    else concat(
      'GEN1 PRE_EVENT: range 15/30/60 = ',
      coalesce(round(c.gen1_range_15_pts::numeric,1)::text,'--'), '/',
      coalesce(round(c.gen1_range_30_pts::numeric,1)::text,'--'), '/',
      coalesce(round(c.gen1_range_60_pts::numeric,1)::text,'--'), ' pts.')
  end as historical_reason,
  case
    when c.confluence_level = 'CONFLICT'
      then 'Risco principal: divergencia entre camadas direcionais.'
    when c.event_alignment = 'SEMANTIC_CONFLICT'
      then 'Risco principal: conflito semantico entre componentes do evento.'
    when c.gen1_alignment = 'RISK_CONFLICT'
      then 'Risco principal: GEN1 registra conflito PB50/PB70.'
    when coalesce(c.market_product_status,'') <> 'LEITURA_DISPONIVEL'
      then 'Risco principal: Market State ainda sem leitura live valida.'
    when coalesce(c.playbook_status,'INSUFFICIENT') <> 'CONFIRMED'
      then 'Risco principal: Playbook estrutural nao esta confirmado.'
    else 'Risco principal: nenhum risco prioritario adicional foi definido pela regra V1.'
  end as main_risk,
  case
    when c.evidence_coverage = 'NONE' then 'INSUFFICIENT'
    when c.evidence_coverage = 'MINIMAL' then 'PARTIAL'
    else 'OK'
  end as quality_warning,
  false::boolean as probability_of_profit_analysis,
  false::boolean as operational_authorized_analysis
from public.riskdesk_product_confluence_v1 c;

grant select on public.riskdesk_product_analysis_v1 to anon, authenticated;
