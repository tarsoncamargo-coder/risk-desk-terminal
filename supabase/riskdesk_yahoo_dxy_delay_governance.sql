-- Yahoo DXY governance note: delayed context only.
update public.live_source_registry
set status='ACTIVE_DELAYED_CONTEXT_ONLY',
    notes='Observed transport/availability lag around 10 minutes on 2026-10-13. Do not count as fresh live cross-asset input. Timestamped values may still be used later for exact event-window research after arrival; never pretend they were available at +5.',
    updated_at=now()
where source_key='YAHOO_DXY';
