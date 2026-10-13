-- Risk Desk live auxiliary feeds V2
-- DXY/VIX/VXN are best-effort context feeds with staleness guards.

alter table public.live_market_minute
  drop constraint if exists live_market_minute_asset_check;

alter table public.live_market_minute
  add constraint live_market_minute_asset_check
  check (asset = any (array['NQ','ZQ','ZT','ZN','DXY','VIX','VXN']::text[]));

alter table public.live_market_state
  add column if not exists vix_raw_pct double precision,
  add column if not exists vxn_raw_pct double precision,
  add column if not exists vix_reading text,
  add column if not exists vxn_reading text;

insert into public.live_source_registry
(source_key,source_name,role,authority_level,paid_required,api_key_required,status,notes)
values
('YAHOO_VIX','Yahoo Finance ^VIX','VIX best-effort intraday volatility context','BEST_EFFORT',false,false,'ACTIVE_WITH_STALENESS_GUARD','Unofficial/no-SLA context source. Must become unavailable when stale; never treated as official.'),
('YAHOO_VXN','Yahoo Finance ^VXN','VXN best-effort intraday Nasdaq volatility context','BEST_EFFORT',false,false,'ACTIVE_WITH_STALENESS_GUARD','Unofficial/no-SLA context source. Must become unavailable when stale; never treated as official.')
on conflict (source_key) do update
set source_name=excluded.source_name,
    role=excluded.role,
    authority_level=excluded.authority_level,
    paid_required=excluded.paid_required,
    api_key_required=excluded.api_key_required,
    status=excluded.status,
    notes=excluded.notes,
    updated_at=now();
