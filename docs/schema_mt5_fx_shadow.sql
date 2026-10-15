-- PREPARADO PARA REVISAO. NENHUMA MIGRACAO EXECUTADA NESTA PR.
-- Fonte visual experimental; nao altera tabelas J7/J11/J12.
CREATE TABLE IF NOT EXISTS public.riskdesk_mt5_fx_shadow (
  symbol text PRIMARY KEY CHECK (symbol IN ('EURUSD','USDJPY','GBPUSD','USDCAD','USDSEK','USDCHF','DXY_SYNTH')),
  source text NOT NULL DEFAULT 'MT5_ACTIVTRADES_SHADOW' CHECK (source = 'MT5_ACTIVTRADES_SHADOW'),
  bid double precision,
  ask double precision,
  mid double precision,
  as_of_utc timestamptz NOT NULL,
  tick_utc timestamptz,
  broker_offset_seconds integer,
  tick_age_seconds double precision,
  quality_status text NOT NULL CHECK (quality_status IN ('RECENT','STALE','UNAVAILABLE'))
);
ALTER TABLE public.riskdesk_mt5_fx_shadow ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.riskdesk_mt5_fx_shadow FROM anon, authenticated;
GRANT SELECT ON TABLE public.riskdesk_mt5_fx_shadow TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.riskdesk_mt5_fx_shadow TO service_role;
DROP POLICY IF EXISTS mt5_fx_shadow_public_read ON public.riskdesk_mt5_fx_shadow;
CREATE POLICY mt5_fx_shadow_public_read ON public.riskdesk_mt5_fx_shadow
  FOR SELECT TO anon, authenticated USING (true);
-- A chave de escrita so pode ser guardada no Windows, nunca no site.
