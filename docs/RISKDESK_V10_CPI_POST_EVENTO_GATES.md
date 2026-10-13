# Risk Desk V10 — Gate operacional e auditoria pós-evento (14/10/2026)

## Objetivo
Verificar a integridade da cadeia de **pesquisa/contexto** do Risk Desk sem alterar Laranjinha, executar ordens ou transformar GEN2 SHADOW em sinal operacional.

## Estado observado antes do CPI
- J7A/NinjaTrader envia NQ, ZN e ZT com timestamps recentes; ZQ pode ficar sem negócios por vários minutos.
- J11/J12 voltaram a publicar heartbeats em 13/10/2026. `WARMUP` significa **processo ativo, evento prospectivo ainda não processado**.
- J7B agenda oficial BLS funciona, mas heartbeat informa `bls_actual_mode=UNREGISTERED_V1_LIMITED`.
- `live_event_component`, `live_event_semantic_state`, `gen1_event_context_history` e `gen2_shadow_prediction_history`: zero registros na inspeção pré-CPI.
- DXY Yahoo pode carregar ~10 min de atraso; VIX/VXN podem estar fora da sessão.
- Não utilizar dados históricos ou `HISTORICAL_SMOKE_ONLY` como POST5 prospectivo.

## Agenda alvo (BRT, 14/10/2026)
CPI programado para 09:30 (12:30 UTC), sujeito a alteração oficial.

| Marco | Horário BRT | Condição de aprovação |
|---|---|---|
| PRE1440 | 13/10 09:30 | snapshot da janela realmente persistido |
| PRE240 | 14/10 05:30 | snapshot persistido e referência congelada |
| PRE60 | 14/10 08:30 | snapshot persistido |
| PRE30 | 14/10 09:00 | snapshot persistido |
| PRE15 | 14/10 09:15 | snapshot persistido |
| PRE5 | 14/10 09:25 | snapshot persistido |
| RELEASE | 14/10 09:30 | Actual oficial com source + available_at; consenso/surpresa com origem |
| POST1 | 14/10 09:31 | observação auditável M1 |
| POST5 | 14/10 09:35 | J11 prospectivo, GEN1 POST_5M e GEN2 SHADOW com timestamps e evento corretos |
| POST15 | 14/10 09:45 | movimento observado na janela +15, não previsão |
| POST30 | 14/10 10:00 | movimento observado na janela +30 |
| POST60 | 14/10 10:30 | movimento observado na janela +60 |

## Regras obrigatórias
1. Evento identificado por `event_id` e `scheduled_ts_utc` iguais em produtor e Supabase.
2. `Actual` não é igual a calendário. Consenso não é inventado e depende de sua própria fonte.
3. `Surprise` somente quando escala/unidade e consenso forem comparáveis e a fonte for rastreável.
4. Semântica J11 não publicada sem `prospective_fresh=true`, `mapping_complete=true` e timestamp posterior ao evento.
5. GEN2 usa motor congelado J10. `shadow_only=true`, `operational_authorized=false`, sem retrain/recalibração.
6. `GEN1 POST_5M` não é o mesmo que range realizado de POST15/30/60.
7. Para o modo CONFIRMAÇÃO, **ambos** devem existir: janela POST observada e matriz cross-asset alinhada à **mesma janela POST**. LIVE/PRE não pode ser reinterpretado como POST.
8. Freshness do dado é `now - ts_utc`, nunca a idade do heartbeat. `SPARSE/DELAYED/OFF_SESSION/UNAVAILABLE` não votam.
9. Mapa Cross-Asset descritivo não altera a Confluência V1 nem autoriza qualquer operação.

## Dependência ainda em aberto
A aquisição automática de Actual do J7B está marcada `UNREGISTERED_V1_LIMITED`; **não foi corrigida apenas pelo frontend**. Para implementar e testar a correção no coletor local sem perder a configuração atual, recuperar a versão exata de `riskdesk_live_j7b_free_FIX1.py` (ou nome equivalente) e o launcher instalado. Não incluir secrets de Supabase no repositório ou no chat.

## Verificação após o release
Confirmar no Supabase: `live_event_state` → `live_event_component` → `live_event_semantic_state` → `gen1_event_context_history` → `gen2_shadow_prediction_history`, com event_id, timestamp, versões e sinalização de qualidade. Se uma etapa falhar, classificar como **PENDENTE/BLOQUEADA**, não como previsão neutra. Não abrir uploaders duplicados.

**Status:** plano de auditoria; a homologação prospectiva depende de um evento real futuro.
