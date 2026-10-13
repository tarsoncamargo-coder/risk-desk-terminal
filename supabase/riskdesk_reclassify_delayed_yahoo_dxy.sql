-- Reclassify empirically delayed Yahoo DXY rows.
update public.live_market_minute
set quality_status = 'DELAYED_SOURCE'
where asset = 'DXY'
  and source = 'YAHOO_DXY'
  and quality_status = 'OK'
  and received_at is not null
  and extract(epoch from (received_at - ts_utc)) > 180;

insert into public.model_governance(component,version,status,operational_authorized,reason)
values
('YAHOO_DXY_DATA_QUALITY','V1','BACKFILL_CORRECTED',false,'Historical Yahoo DXY rows whose received_at lagged ts_utc by more than 3 minutes were reclassified from OK to DELAYED_SOURCE so research/live windows cannot treat delayed observations as contemporaneously available.')
on conflict (component,version) do update
set status=excluded.status,
    operational_authorized=excluded.operational_authorized,
    reason=excluded.reason;
