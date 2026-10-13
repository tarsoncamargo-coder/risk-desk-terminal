-- Risk Desk source registry RLS hardening
-- Keeps public read access for the terminal, removes anon/auth writes,
-- and makes the public view obey caller permissions/RLS.

drop policy if exists riskdesk_public_read_live_source_registry
on public.live_source_registry;

create policy riskdesk_public_read_live_source_registry
on public.live_source_registry
for select
to anon, authenticated
using (true);

revoke insert, update, delete, truncate, references, trigger
on public.live_source_registry from anon, authenticated;

grant select on public.live_source_registry to anon, authenticated;

alter table public.live_source_registry enable row level security;

alter view public.riskdesk_live_sources_v1
set (security_invoker = true);
