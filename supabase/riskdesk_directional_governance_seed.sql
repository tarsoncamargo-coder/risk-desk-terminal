-- Risk Desk directional-context governance registrations
insert into public.model_governance(component,version,status,operational_authorized,reason)
values
('DIRECTIONAL_MATRIX','V1','CONTEXT_READY',false,'Cross-asset event-relative matrix for NQ, ZT proxy 2Y, ZN proxy 10Y, DXY, ZQ and volatility. Sign-direction only, no weighted score, no profit probability.'),
('RELATED_EVENT_CONTEXT','V1','CONTEXT_READY',false,'Curated family relationships expose recent related releases when semantic readings are actually available. Relevance ordering is fixed; contrary evidence is not hidden.'),
('RISK_DESK_ANALYSIS','V2','STRUCTURED_CONTEXT_READY',false,'Adds deterministic cross-asset and related-event evidence to the structured analysis. No operational authorization.')
on conflict (component,version) do update
set status=excluded.status,
    operational_authorized=excluded.operational_authorized,
    reason=excluded.reason;
