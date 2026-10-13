-- Risk Desk Directional Matrix + Related Events V1
-- Context-only. No weighted score, no probability of profit and no operational authorization.

create table if not exists public.riskdesk_event_relation_registry_v1 (
  event_family text not null,
  related_family text not null,
  priority integer not null check (priority between 1 and 9),
  relation_label text not null,
  rationale text not null,
  active boolean not null default true,
  primary key (event_family, related_family)
);

alter table public.riskdesk_event_relation_registry_v1 enable row level security;

drop policy if exists riskdesk_public_read_event_relation_registry_v1
on public.riskdesk_event_relation_registry_v1;

create policy riskdesk_public_read_event_relation_registry_v1
on public.riskdesk_event_relation_registry_v1
for select to anon, authenticated
using (active = true);

revoke insert, update, delete, truncate, references, trigger
on public.riskdesk_event_relation_registry_v1 from anon, authenticated;
grant select on public.riskdesk_event_relation_registry_v1 to anon, authenticated;
grant select, insert, update, delete on public.riskdesk_event_relation_registry_v1 to service_role;

insert into public.riskdesk_event_relation_registry_v1
(event_family,related_family,priority,relation_label,rationale,active)
values
('CPI','PCE',1,'Inflacao de consumo','PCE/Core PCE complementa a leitura de inflacao ao consumidor.',true),
('CPI','PPI',2,'Pressao de precos na origem','PPI pode reforcar ou contrariar a pressao inflacionaria observada no CPI.',true),
('CPI','EMPLOYMENT',3,'Trabalho e salarios','Emprego e salarios ajudam a contextualizar persistencia de inflacao e pressao monetaria.',true),
('EMPLOYMENT','CLAIMS',1,'Claims','Pedidos de seguro-desemprego complementam a leitura de forca/fraqueza do trabalho.',true),
('EMPLOYMENT','JOLTS',2,'JOLTS','Vagas e dinamica de contratacao complementam a leitura do mercado de trabalho.',true),
('EMPLOYMENT','CPI',3,'Inflacao','CPI ajuda a separar forca do trabalho de pressao inflacionaria/monetaria.',true)
on conflict (event_family,related_family) do update
set priority=excluded.priority,
    relation_label=excluded.relation_label,
    rationale=excluded.rationale,
    active=excluded.active;

create or replace view public.riskdesk_product_related_events_v1
with (security_invoker = true)
as
with target as (
  select event_id,event_family,scheduled_ts_utc,'CURRENT'::text as event_role
  from public.riskdesk_product_current_event_v1
  union all
  select event_id,event_family,scheduled_ts_utc,'NEXT'::text as event_role
  from public.riskdesk_product_next_event_v1
  where not exists (select 1 from public.riskdesk_product_current_event_v1)
),
target_sem as (
  select t.*, s.stance_bundle as target_stance
  from target t
  left join public.live_event_semantic_state s on s.event_id=t.event_id
)
select
  t.event_id as target_event_id,
  t.event_family as target_family,
  t.event_role,
  t.scheduled_ts_utc as target_ts_utc,
  t.target_stance,
  r.related_family,
  r.priority,
  r.relation_label,
  r.rationale,
  rel.event_id as related_event_id,
  rel.scheduled_ts_utc as related_ts_utc,
  rel.actual,
  rel.consensus,
  rel.previous,
  rel.revised,
  rel.official_surprise,
  rel.surprise_status,
  rs.stance_bundle as related_stance,
  case
    when rel.event_id is null then 'NO_RELEASE_AVAILABLE'
    when rs.stance_bundle is null then 'NO_SEMANTIC_READING'
    else 'READY'
  end as availability_status,
  case
    when rel.event_id is null or t.target_stance is null or rs.stance_bundle is null then 'UNAVAILABLE'
    when upper(t.target_stance) in ('MIXED','NEUTRAL') or upper(rs.stance_bundle) in ('MIXED','NEUTRAL') then 'NEUTRAL'
    when upper(t.target_stance)=upper(rs.stance_bundle) then 'ALIGNED'
    else 'CONTRARY'
  end as alignment,
  case
    when rel.scheduled_ts_utc is null then null
    else extract(epoch from (t.scheduled_ts_utc-rel.scheduled_ts_utc))/86400.0
  end as age_days
from target_sem t
join public.riskdesk_event_relation_registry_v1 r
  on r.event_family=t.event_family and r.active=true
left join lateral (
  select e.*
  from public.live_event_state e
  where e.event_family=r.related_family
    and e.scheduled_ts_utc < t.scheduled_ts_utc
    and (
      e.actual is not null
      or e.raw_actual is not null
      or e.status not in ('SCHEDULED','PRE_EVENT')
    )
  order by e.scheduled_ts_utc desc
  limit 1
) rel on true
left join public.live_event_semantic_state rs on rs.event_id=rel.event_id
order by r.priority;

grant select on public.riskdesk_product_related_events_v1 to anon, authenticated;

create or replace view public.riskdesk_product_directional_matrix_v1
with (security_invoker = true)
as
with target as (
  select event_id,event_family,scheduled_ts_utc,'CURRENT'::text as event_role
  from public.riskdesk_product_current_event_v1
  union all
  select event_id,event_family,scheduled_ts_utc,'NEXT'::text as event_role
  from public.riskdesk_product_next_event_v1
  where not exists (select 1 from public.riskdesk_product_current_event_v1)
),
ctx as (
  select
    t.*, s.stance_bundle, s.data_quality as semantic_data_quality,
    m."window", m.product_status, m.data_status,
    m.nq_raw_pct, m.zq_raw_pct, m.zt_raw_pct, m.zn_raw_pct, m.dxy_raw_pct,
    m.risk_reading, m.sigma_reading, m.sigma_z
  from target t
  left join public.live_event_semantic_state s on s.event_id=t.event_id
  left join lateral (
    select x.*
    from public.riskdesk_product_market_state_v2_v1 x
    where x.event_id=t.event_id
    order by
      case
        when x.product_status='LEITURA_DISPONIVEL' and x."window"='LIVE' then 0
        when x.product_status='LEITURA_DISPONIVEL' and x."window"='PRE5' then 1
        when x.product_status='LEITURA_DISPONIVEL' and x."window"='PRE15' then 2
        when x.product_status='LEITURA_DISPONIVEL' and x."window"='PRE30' then 3
        when x.product_status='LEITURA_DISPONIVEL' and x."window"='PRE60' then 4
        when x.product_status='LEITURA_DISPONIVEL' then 5
        when x."window"='LIVE' then 6
        when x."window"='PRE5' then 7
        when x."window"='PRE15' then 8
        when x."window"='PRE30' then 9
        when x."window"='PRE60' then 10
        else 99
      end, x.as_of_utc desc
    limit 1
  ) m on true
),
rows as (
  select c.*,v.*
  from ctx c
  cross join lateral (
    values
      (1,'EVENT','Evento',null::double precision,'EVENT',null::text),
      (2,'NQ','Nasdaq',c.nq_raw_pct,'PCT','NQ'),
      (3,'US2Y','2Y / ZT proxy',c.zt_raw_pct,'PCT','ZT'),
      (4,'US10Y','10Y / ZN proxy',c.zn_raw_pct,'PCT','ZN'),
      (5,'DXY','DXY',c.dxy_raw_pct,'PCT','DXY'),
      (6,'ZQ','ZQ / Fed Path',c.zq_raw_pct,'PCT','ZQ'),
      (7,'VOL','Volatilidade',c.sigma_z,'SIGMA_Z','VOL')
  ) as v(sort_order,layer_key,label,raw_value,value_unit,asset_key)
)
select
  event_id,event_family,event_role,scheduled_ts_utc,stance_bundle as event_stance,
  "window" as market_window,product_status,sort_order,layer_key,label,raw_value,value_unit,
  case
    when layer_key='EVENT' then coalesce(stance_bundle,'AGUARDANDO')
    when layer_key='VOL' then coalesce(risk_reading,sigma_reading,'UNAVAILABLE')
    when raw_value is null then 'UNAVAILABLE'
    when raw_value > 0 then 'UP'
    when raw_value < 0 then 'DOWN'
    else 'NEUTRAL'
  end as observed_direction,
  case
    when layer_key='EVENT' and stance_bundle is null then 'WAITING'
    when layer_key='EVENT' then 'BASE'
    when stance_bundle is null then 'WAITING_EVENT_SEMANTIC'
    when product_status <> 'LEITURA_DISPONIVEL' then 'WAITING_MARKET_DATA'
    when layer_key='VOL' and coalesce(risk_reading,'UNAVAILABLE')='UNAVAILABLE' then 'UNAVAILABLE'
    when layer_key='VOL' and upper(stance_bundle)='DOVISH' and upper(risk_reading) like '%RISK_ON%' then 'ALIGNED'
    when layer_key='VOL' and upper(stance_bundle)='DOVISH' and upper(risk_reading) like '%RISK_OFF%' then 'CONTRARY'
    when layer_key='VOL' and upper(stance_bundle)='HAWKISH' and upper(risk_reading) like '%RISK_OFF%' then 'ALIGNED'
    when layer_key='VOL' and upper(stance_bundle)='HAWKISH' and upper(risk_reading) like '%RISK_ON%' then 'CONTRARY'
    when layer_key='VOL' then 'NEUTRAL'
    when raw_value is null then 'UNAVAILABLE'
    when raw_value = 0 then 'NEUTRAL'
    when upper(stance_bundle)='DOVISH' and layer_key in ('NQ','US2Y','US10Y','ZQ') and raw_value > 0 then 'ALIGNED'
    when upper(stance_bundle)='DOVISH' and layer_key='DXY' and raw_value < 0 then 'ALIGNED'
    when upper(stance_bundle)='HAWKISH' and layer_key in ('NQ','US2Y','US10Y','ZQ') and raw_value < 0 then 'ALIGNED'
    when upper(stance_bundle)='HAWKISH' and layer_key='DXY' and raw_value > 0 then 'ALIGNED'
    when upper(stance_bundle) in ('HAWKISH','DOVISH') then 'CONTRARY'
    else 'NEUTRAL'
  end as alignment,
  case
    when layer_key='EVENT' then 'Leitura semantica do evento atual.'
    when layer_key='US2Y' then 'Proxy ZT: alta do futuro normalmente corresponde a queda de yield 2Y.'
    when layer_key='US10Y' then 'Proxy ZN: alta do futuro normalmente corresponde a queda de yield 10Y.'
    when layer_key='ZQ' then 'Fed Funds futures: alta do preco normalmente corresponde a expectativa de taxa menor.'
    when layer_key='VOL' then 'Volatilidade usa leitura de risco e Sigma quando disponiveis.'
    else 'Reacao cross-asset observada na janela selecionada.'
  end as detail,
  false::boolean as score_authorized,
  false::boolean as operational_authorized,
  'SIGN_DIRECTION_V1_NO_WEIGHTED_SCORE'::text as methodology
from rows
order by sort_order;

grant select on public.riskdesk_product_directional_matrix_v1 to anon, authenticated;
