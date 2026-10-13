# Risk Desk — Gap Analysis V1

Data da auditoria: 2026-10-12/13
Branch base: main @ 32490f56122b5ce5a22d536eed570d5f9cf9acdc
Supabase: risk-desk (pkmjknlbsptqhanejddm)

## Objetivo

Mapear o Front-End Data Contract V1 contra o estado real do site e do Supabase antes de qualquer redesign ou alteração estrutural. Esta etapa não altera GEN1, GEN2, J11, calibração ou Laranjinha.

## Estado atual do front-end

O site publicado é estático em GitHub Pages, com:
- index.html
- app.js
- styles.css
- pipeline/ (bridge/uploader J7A)

Abas atuais:
- Hoje
- Evento
- Macro
- Nasdaq
- Histórico / Backtest

Não existe ainda uma aba Sistema dedicada.

O front-end consulta diretamente o REST do Supabase com chave publishable. Isso é adequado para cliente público desde que as tabelas/views expostas tenham RLS/policies corretas.

## O que já existe no Supabase

### Eventos live
- live_event_state
- live_event_component
- live_consensus_input
- riskdesk_live_next_event_v1
- riskdesk_live_upcoming_events_v1
- riskdesk_live_latest_event_v1
- riskdesk_live_latest_event_components_v1

Cobertura live atual:
- CPI: 15 eventos agendados
- EMPLOYMENT: 14 eventos agendados
- live_event_component: 0 linhas na auditoria

### Mercado live
- live_market_minute
- live_market_state
- riskdesk_live_market_state_latest_v1
- riskdesk_live_dimensions_v1
- riskdesk_live_latest_quotes_v1
- riskdesk_live_window_inputs_v1

A estrutura já guarda leituras separadas para:
- NQ
- ZQ
- ZT
- ZN
- DXY
- policy_reading
- rates_2y_reading
- rates_10y_reading
- risk_reading
- dollar_reading
- sigma_reading
- cross_asset_signature
- missing_assets
- data_status

### Regime / playbook
- macro_regime_daily
- live_regime_state
- playbook_snapshot
- riskdesk_live_regime_latest_v1
- riskdesk_latest_macro_regime_v1

O regime live atual está em modo seguro de carry-forward. Growth/Inflation e confiança não devem ser sintetizados até a metodologia original estar validada.

### Sigma
- sigma_snapshot (histórico)
- live_sigma_state
- riskdesk_live_sigma_latest_v1
- riskdesk_live_sigma_today_v1

A tabela histórica sigma_snapshot tem bug de empacotamento já registrado: valores históricos sigma_value/z_current nulos. A camada live é separada.

### Saúde do pipeline
- live_pipeline_heartbeat
- riskdesk_live_status_v1
- riskdesk_live_dashboard_v1
- data_quality

### Histórico atual do site
- event_snapshot: 105 eventos, todos CPI
- market_snapshot: 630
- macro_regime_daily: 105
- playbook_snapshot: 105
- sigma_snapshot: 38.437
- model_governance: 19

## Mapeamento contra o Front-End Data Contract V1

### 1. Evento central

Status: PARCIALMENTE PRONTO

Já existe:
- event_id
- event_family
- scheduled_ts_utc
- status
- actual
- consensus
- previous
- revised
- official_surprise
- source
- importance
- reference
- source lineage

Falta:
- canonical event name
- bundle_id formal
- surprise_z live
- headline_stance
- stance_intensity
- dominant_component validado
- component_count
- data_quality consolidado por evento
- lifecycle explícito PRE_EVENT / RELEASE / POST1 / POST5 / POST15 / POST30 / POST60 / CLOSED

### 2. Componentes do evento

Status: ESTRUTURA EXISTE, ALIMENTAÇÃO INCOMPLETA

Já existe em live_event_component:
- component_key
- event_name
- actual
- consensus
- previous
- revised
- official_surprise
- fontes
- timestamps

Falta:
- Surprise Z
- semantic_direction
- semantic_pressure_z
- mapping_status
- quality_status
- ligação explícita com o Event Mapping GEN1/J11

Problema atual: live_event_component estava vazio na auditoria.

### 3. Bundle / semântica

Status: FALTA PUBLICAÇÃO NO SUPABASE

A J11 já calcula localmente:
- StanceBundle
- ConflitoSemantico
- PressaoMonetariaZ_Mean
- PressaoDominanteZ
- QtdHawkish
- QtdDovish
- QtdNeutral
- QtdComponentesZSemanticos

Esses campos ainda não estão persistidos em uma estrutura live oficial no Supabase.

### 4. Market State V2

Status: BASE MUITO FORTE, V2 AINDA NÃO IMPLEMENTADA

Já existe:
- janelas PRE1440 / PRE240 / PRE60 / PRE30 / PRE15 / PRE5 / LIVE
- raw moves
- orientações
- leituras por dimensão
- cross_asset_signature
- missing_assets
- regime_reading
- sigma
- data_status

Falta para V2:
- confirmação por ativo relativa ao evento: CONFIRMS / CONTRARY / NEUTRAL / UNAVAILABLE
- market_confirmation consolidado
- market_divergence explícito
- POST1/POST5/POST15/POST30/POST60
- reason estruturado e auditável

Regra mantida:
- Market-Implied Surprise numérico continua aposentado.
- Market State continua context-only até validação.

### 5. Playbook V1

Status: BASE EXISTE, PLAYBOOK V1 COMPLETO AINDA NÃO

Já existe:
- playbook
- growth_score
- inflation_score
- status
- carry_forward
- freshness
- baseline lineage

Falta:
- labor_axis
- financial_conditions_axis
- supporting_evidence
- contrary_evidence
- transition_candidate
- last_material_change estruturado
- interpretação por evento no site

Restrição metodológica:
- Não sintetizar Growth/Inflation/Confidence que não foram reconstruídos exatamente.
- Usar o modo seguro atual até nova validação.

### 6. GEN1

Status: MODELOS EXISTEM FORA DESTA API, NÃO INTEGRADOS AO SITE ATUAL

O site main atual não exibe o pacote final GEN1 por evento.
Falta publicar um contrato de leitura para:
- range 15/30/60
- MFE
- MAE
- continuation
- pullback
- reversal
- sample_size
- model_version
- quality_status

Não alterar os 16 modelos finais.

### 7. GEN2 Shadow

Status: MODELO/J10/J11 EXISTEM, INTEGRAÇÃO NO SITE MAIN NÃO ESTÁ FECHADA

O app.js atual não possui card GEN2.
O heartbeat GEN2_SHADOW encontrado no Supabase estava em WARMUP e ainda registrava as 15 features como ausentes.

Isso não invalida a J11 local aprovada, mas prova que a integração J11 -> uploader -> Supabase ainda precisa ser validada ponta a ponta no evento prospectivo J12.

Falta publicar/consumir:
- p_up_raw
- p_up_isotonic
- direction
- family
- prediction_source
- model/version
- prediction_timestamp
- prospective_fresh
- shadow_only
- flags de governança

Semântica obrigatória:
P(ALTA | MOVIMENTO RELEVANTE)
Nunca "probabilidade de lucro".

### 8. Confluência

Status: NÃO IMPLEMENTADA

Falta estrutura oficial para:
- event_alignment
- market_alignment
- playbook_alignment
- gen1_alignment
- gen2_alignment
- cross_asset_alignment
- confluence_level
- direction
- main_risk
- reason

Saída categórica:
- HIGH
- MODERATE
- LOW
- CONFLICT
- INDETERMINATE

Não criar porcentagem de confluência neste estágio.

### 9. Risk Desk Analysis

Status: NÃO IMPLEMENTADO COMO CONTRATO

Falta síntese estruturada baseada apenas em campos existentes:
- macro_reason
- market_reason
- historical_reason
- model_reason
- main_risk
- quality_warning
- summary

Não usar texto livre que invente fatos.

### 10. Histórico prospectivo

Status: NÃO EXISTE

Falta persistência imutável de cada previsão prospectiva:
- evento
- features disponíveis naquele momento
- GEN2 raw/calibrado
- família/model source
- playbook_at_prediction
- market_state_at_prediction
- confluence_at_prediction
- timestamps
- resultado +5/+15/+30/+60
- MFE/MAE/range

A previsão original não pode ser sobrescrita retrospectivamente.

## Gaps específicos do site atual

### Tela Hoje
Hoje mostra:
- regime
- growth/inflation score
- PRE60
- último evento histórico
- qualidade
- heartbeat

Ainda faltam:
- próximo evento real
- current event live
- interpretação macro
- confluência
- Market State V2
- Playbook V1 contextual
- GEN1
- GEN2
- cross-asset compacto
- Risk Desk Analysis

### Tela Evento
Hoje é essencialmente CPI histórico.
Precisa virar:
- calendário multi-família
- upcoming/today/history
- dossiê
- componentes
- timeline PRE -> POST60

### Tela Macro
Já possui boa base visual de regime.
Precisa adicionar:
- eixos adicionais quando metodologicamente autorizados
- evidências favoráveis/contrárias
- transição
- eventos que alteraram a narrativa

### Tela Nasdaq
Hoje usa snapshots históricos e sigma histórico.
Precisa priorizar live:
- current event
- live Market State V2
- live sigma
- GEN1
- GEN2
- playbook
- confluence
- cross-asset

### Tela Histórico
Hoje é governança/estatística descritiva.
Precisa adicionar histórico prospectivo real.

### Tela Sistema
Não existe.
Deve consumir heartbeat, freshness, fontes, versões e erros.

## Problemas/alertas encontrados

1. Segurança: public.live_source_registry está com RLS desabilitado.
   Não corrigir automaticamente sem definir policies, porque habilitar RLS sem policies pode quebrar o site.

2. riskdesk_live_latest_event_v1 ordena pelo maior scheduled_ts_utc e hoje pode retornar um evento futuro distante. Para o produto final, separar semanticamente:
   - next_event
   - current_event
   - latest_released_event

3. GEN2_SHADOW no Supabase ainda não demonstra a J11 completa ponta a ponta; o último heartbeat auditado ainda dizia WAITING_EXACT_LIVE_FEATURE_SCHEMA.

4. live_event_component está vazio; portanto o Dossiê cirúrgico ainda não pode ser considerado live.

5. Histórico event_snapshot atual cobre somente CPI (105 casos). Os templates multi-família não estão publicados no histórico do site.

6. O site main do GitHub está em J7A; as evoluções J10/J11 não estão incorporadas no front-end main.

## Ordem recomendada de implementação

1. Criar views de produto sem alterar os motores:
   - current/next/latest-released event
   - live event components enriched
   - live market context
   - system health

2. Publicar no Supabase a saída semântica J11 e a inferência GEN2 shadow, com histórico imutável.

3. Implementar Dossiê + Templates no front-end.

4. Implementar Market State V2 por derivação dos dados já existentes, sem score mágico.

5. Implementar Playbook V1 mantendo as restrições metodológicas atuais.

6. Implementar Motor de Confluência.

7. Implementar Risk Desk Analysis.

8. Fazer redesign visual final e responsivo.

9. Expandir histórico prospectivo.

10. Rodar J12 assim que houver um POST5 genuinamente fresco.

## Proteções obrigatórias

- GEN1 congelado: não alterar.
- GEN2 congelado: não alterar/retunar.
- Isotonic congelada: não recalibrar.
- J11: preservar.
- Laranjinha: não tocar.
- probability_of_profit = false.
- trade_signal = false.
- entry_filter = false.
- operational_authorized = false.
- Não criar Market-Implied Surprise numérico.
- Não criar score/probabilidade de confluência sem validação.

## Conclusão

A infraestrutura atual é melhor do que a interface sugere. Grande parte dos dados live, governança, regime, Market State e saúde do pipeline já existe no Supabase.

Os maiores gaps não são "reconstruir o Risk Desk", mas:
1. publicar semântica/GEN2 prospectivos no Supabase;
2. criar contratos/views de produto;
3. ampliar o dossiê para múltiplas famílias;
4. implementar confluência e análise;
5. redesenhar a interface para expor tudo isso com hierarquia.
