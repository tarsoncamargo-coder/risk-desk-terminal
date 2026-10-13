-- Risk Desk V1 governance registrations
insert into public.model_governance(component,version,status,operational_authorized,reason)
values
('CONFLUENCE_ENGINE','V1','CONTEXT_READY',false,'Deterministic state machine over valid directional layers. No weighted score, no probability of profit, no trade signal. Event semantics and GEN1 remain context/risk modifiers; cross-asset is not double-counted outside Market State.'),
('RISK_DESK_ANALYSIS','V1','STRUCTURED_CONTEXT_READY',false,'Deterministic structured analysis assembled only from Event, Market State V2, Playbook, GEN1, GEN2 and Confluence fields. No free-form live inference and no operational authorization.'),
('GEN1_CONTEXT_PUBLISHER','V1','SCHEMA_READY_AWAITING_LIVE_EVENT',false,'Immutable PRE_EVENT/POST_5M GEN1 context persistence prepared. Range/MFE/MAE/PB50/PB70/REV100 remain historical/context only.')
on conflict (component,version) do update
set status=excluded.status,
    operational_authorized=excluded.operational_authorized,
    reason=excluded.reason;
