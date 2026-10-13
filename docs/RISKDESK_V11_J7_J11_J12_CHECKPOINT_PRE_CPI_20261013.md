# Risk Desk V11 — Auditoria LIVE J7 → J11 → J12 (13/10/2026)

**Tipo:** checkpoint factual e plano de homologação prospectiva — **somente leitura**.  
**Fonte:** Supabase `risk-desk` (projeto `pkmjknlbsptqhanejddm`) e repositório `risk-desk-terminal` consultados em 13/10/2026.  
**Evento de referência:** CPI BLS, `BLS:CPI:20261014T1230Z` (agenda armazenada para **14/10/2026 12:30 UTC / 09:30 BRT**; horário deve ser confirmado na fonte oficial antes de operar).  
**Convivência com o histórico:** V11 histórico = 12.953 eventos reconciliados e índice numérico **candidato** de 4.666 minutos. Não está importado/autorizado para os produtores LIVE, modelos nem treinamento.

## 1. Situação observada (não confundir com homologação)

| Evidência | Leitura de 13/10 | Gate |
|---|---|---|
| `live_event_state` | 29 registros; todos `SCHEDULED`; 0 Actual; 0 Surprise | **AGUARDANDO RELEASE** |
| `live_consensus_input` | 4 componentes CPI marcados `ACTIVE`, com fonte declarada e `observed_at=2026-10-13 08:24 UTC` | **PRÉ-RELEASE REGISTRADO**, origem AS-OF externa não auditada nesta leitura |
| `live_market_state` | `PRE1440` registrado em `2026-10-13 12:30 UTC`; `IN_PROGRESS/PARTIAL`; DXY ausente; `composite_authorized=false` | **PARCIAL, NÃO É CONFLUÊNCIA APROVADA** |
| `PRE240/PRE60/PRE30/PRE15/PRE5` | Ainda `WAITING` antes do CPI | **ESPERADO ANTES DAS JANELAS** |
| `live_event_component` | 0 linhas | **AGUARDANDO ACTUAL PROSPECTIVO** |
| `live_event_semantic_state` | 0 linhas | **J11 AINDA NÃO HOMOLOGADO** |
| `gen1_event_context_history` | 0 linhas | **J12 / GEN1 AINDA NÃO HOMOLOGADO** |
| `gen2_shadow_prediction_history` | 0 linhas | **J12 / GEN2 SHADOW AINDA NÃO HOMOLOGADO** |
| `GEN2_SHADOW` heartbeat | `WARMUP`, `HISTORICAL_OR_STALE_NOT_ELIGIBLE_FOR_J12`, `HISTORICAL_SMOKE_ONLY` rejeitado | **BLOQUEIO CORRETO, NÃO PROVA PROSPECTIVA** |
| `EVENT_ENGINE` heartbeat | `OK`; `bls_actual_mode=UNREGISTERED_V1_LIMITED_NOT_NEWSWIRE` | **GARGALO A VERIFICAR NO J7B LOCAL** |
| Últimos `heartbeats` principais | Entre `19:51` e `19:57 UTC`; consulta do banco `20:40 UTC` | **FRESHNESS PENDENTE; STATUS OK SOZINHO NÃO PROVA PROCESSO ATIVO** |
| `live_market_minute` | NQ, ZT, ZN e ZQ com último minuto `19:55 UTC`; DXY último `19:47 UTC`, recebido `19:57 UTC` | **DXY ATRASADO; NÃO VOTA COMO FRESCO** |
| `riskdesk_product_current_event_v1` | 0 linhas no pré-evento; `riskdesk_product_next_event_v1` 1 linha | **CONSISTENTE COM PRÉ-RELEASE** |

**Interpretação:** a captura da agenda, o armazenamento de consensos e snapshots PRE existem. O encadeamento de **Actual oficial → componentes → semântica J11 → GEN1/GEN2 J12 → site** ainda não foi demonstrado com uma divulgação prospectiva. Não declarar “J11/J12 funcionando” apenas porque o heartbeat relata `WARMUP`.

## 2. Ordem de validação em 14/10 — sem ajustar o motor antes de medir

1. **Antes do evento:** confirmar calendário, fuso, `event_id`, `scheduled_ts_utc`, quatro componentes de consenso (fonte, unidades e `observed_at` pré-evento) e executores locais; capturar `PRE240`, `PRE60`, `PRE30`, `PRE15`, `PRE5`. PRE1440 já teve primeiro snapshot, mas ficou `PARTIAL` — não promovê-lo retroativamente.
2. **No release:** verificar se `live_event_state.status` mudou com `actual` oficial e `available_at`, e se `live_event_component` recebeu componentes, `raw_actual`, `actual_source`, `received_at` e `consensus_source`. Agenda ou `forecast` **não substituem Actual**.
3. **Surprise:** só considerar valor se unidade, escala, componente, fonte e `observed_at` são comparáveis e auditáveis. Null/indisponível = **SEM LEITURA**, nunca surpresa 0 por conveniência.
4. **J11:** verificar `event_id` e `event_ts_utc` iguais ao release, `prospective_fresh=true`, `mapping_complete=true`, `observation_class` não histórica e timestamp de atualização posterior à divulgação. Não inventar HAWKISH/DOVISH.
5. **J12:** buscar saída GEN1 com mesmo evento, estágio correto, e GEN2 `POST_5M` posterior ao release; `shadow_only=true`, `operational_authorized=false`. `HISTORICAL_SMOKE_ONLY` não é aprovação.
6. **POST1/5/15/30/60:** distinguir preço realmente **observado** nas janelas de previsão do modelo; para confluência pós-evento exigir matriz cross-asset correspondente à **mesma janela** e dados frescos. Não reinterpretar PRE/LIVE como POST.
7. **Site:** conferir `next/current/released`, componentes e qualidade das fontes nas views publicadas. Nunca preencher visualmente uma falha do backend com números históricos/candidatos.
8. Se uma etapa falhar, classificar o **primeiro gate ausente** e corrigir localmente em uma mudança mínima após auditar o código/launcher instalado. Não abrir coletores duplicados, não alterar GEN1/GEN2, J7 LIVE ou Supabase sem aprovação específica.

## 3. Consultas SQL de diagnóstico — estritamente SELECT

Executar no SQL Editor do **projeto risk-desk**. Não criar views, não atualizar dados e não mudar permissões.

```sql
-- A. Registro do evento: o agendamento não prova recebimento do Actual.
SELECT event_id, event_family, scheduled_ts_utc, status,
       actual, consensus, official_surprise, available_at,
       updated_at, actual_source, consensus_source, surprise_status
FROM public.live_event_state
WHERE event_id = 'BLS:CPI:20261014T1230Z';

-- B. Consensos registrados ANTES do release e sua rastreabilidade.
SELECT component_key, consensus, source, observed_at, scheduled_ts_utc, status,
       (observed_at IS NOT NULL AND observed_at < scheduled_ts_utc) AS registered_before_release
FROM public.live_consensus_input
WHERE event_key = 'BLS:CPI:20261014T1230Z'
ORDER BY component_key;

-- C. Últimos heartbeats: verificar a idade, não confiar apenas em status OK.
SELECT component, status, last_seen_utc,
       ROUND((EXTRACT(EPOCH FROM (now() - last_seen_utc)) / 60)::numeric, 1) AS minutes_since_last_seen,
       source_version
FROM public.live_pipeline_heartbeat
ORDER BY last_seen_utc DESC;

-- D. Um snapshot mais recente por janela; WAITING não é erro antes da janela.
SELECT DISTINCT ON ("window")
       "window", as_of_utc, event_ts_utc, baseline_ts_utc, endpoint_ts_utc,
       window_status, data_status, active_factors, missing_assets,
       composite_authorized, trade_signal_authorized
FROM public.live_market_state
WHERE event_id = 'BLS:CPI:20261014T1230Z'
ORDER BY "window", as_of_utc DESC;

-- E. Último minuto de cada ativo, com carimbo de chegada; DXY atrasado não é LIVE.
SELECT asset, COUNT(*) AS samples, MAX(ts_utc) AS latest_market_minute,
       MAX(received_at) AS last_ingested
FROM public.live_market_minute
GROUP BY asset
ORDER BY asset;

-- F. Contagem da sequência prospectiva para o mesmo evento.
SELECT 'live_event_component' AS stage, count(*) AS rows
FROM public.live_event_component
WHERE release_id = 'BLS:CPI:20261014T1230Z'
UNION ALL
SELECT 'live_event_semantic_state', count(*)
FROM public.live_event_semantic_state
WHERE event_id = 'BLS:CPI:20261014T1230Z'
UNION ALL
SELECT 'gen1_event_context_history', count(*)
FROM public.gen1_event_context_history
WHERE event_id = 'BLS:CPI:20261014T1230Z'
UNION ALL
SELECT 'gen2_shadow_prediction_history', count(*)
FROM public.gen2_shadow_prediction_history
WHERE event_id = 'BLS:CPI:20261014T1230Z';

-- G. Propriedades da semântica: falta de linhas = pendente, não neutro.
SELECT event_id, event_ts_utc, updated_at, prospective_fresh, mapping_complete,
       observation_class, data_quality, source_version, operational_authorized
FROM public.live_event_semantic_state
WHERE event_id = 'BLS:CPI:20261014T1230Z';

-- H. GEN2: validade temporal e governança, sem probabilidade de lucro.
SELECT event_id, event_ts_utc, prediction_ts_utc, stage, horizon_minutes,
       prospective_fresh, feature_schema_complete, data_quality,
       shadow_only, probability_of_profit, trade_signal,
       entry_filter, operational_authorized
FROM public.gen2_shadow_prediction_history
WHERE event_id = 'BLS:CPI:20261014T1230Z'
ORDER BY prediction_ts_utc DESC;
```

## 4. Checkpoint curto para próxima conferência

Enviar somente os campos necessários, sem screenshots e sem segredos:

```text
=== RESUMO PARA CHATGPT - LIVE CPI J7 J11 J12 ===
AGORA_UTC:
EVENT_ID: BLS:CPI:20261014T1230Z
EVENT_STATUS:
ACTUAL_OFICIAL_E_AVAILABLE_AT:
CONSENSO_PRE_COM_FONTES: 4 componentes / divergencia?
J7B_ACTUAL_MODE:
PRE1440/PRE240/PRE60/PRE30/PRE15/PRE5:
POST1/POST5/POST15/POST30/POST60:
COMPONENTES_PERSISTIDOS:
J11_PROSPECTIVE_FRESH_E_MAPPING_COMPLETE:
J12_GEN1_LINHAS:
J12_GEN2_SHADOW_LINHAS:
CROSS_ASSET_FRESHNESS_E_DXY:
ULTIMOS_HEARTBEATS_IDADE_MIN:
PRIMEIRO_GATE_BLOQUEADO:
TREINO_BACKTEST_IMPORTACAO_OPERACIONAL: NAO
=== FIM RESUMO ===
```

### Escopo protegido

Esta auditoria não altera `main`, site, Supabase LIVE, NinjaTrader/Laranjinha, modelos GEN1/GEN2, corpus V11, calibrações ou coletoras locais. **O código J7B e o launcher instalado no Windows não estão disponíveis neste repositório; nenhuma correção de Actual deve ser inventada sem ler sua versão instalada.** A etapa seguinte de correção exige primeiro obter os arquivos locais reais, sem chaves/tokens.

**Referência anterior:** `docs/RISKDESK_V10_CPI_POST_EVENTO_GATES.md`. Este checkpoint acrescenta dados reais de leitura do banco, mas **não substitui** o protocolo de validação publicado.
