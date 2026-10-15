# Risk Desk Terminal — V10 J6B

Frontend web do projeto Risk Desk Nasdaq V10.

## Backend
O site consulta diretamente o projeto Supabase externo **risk-desk** via publishable key + RLS.

## Abas
- Hoje
- Evento
- Macro
- Nasdaq
- Opções (Gold/MGC + Nasdaq/MNQ, isolado)
- Historico / Backtest

## Governanca
- MAIN: 2018–2025
- SHADOW: 2026
- Market-Implied Surprise numerico: RETIRED
- Market State: CONTEXT LAYER
- Macro Playbooks: CONTEXT ONLY
- Sigma NY: RESEARCH CONTEXT
- Trade signal: NAO AUTORIZADO
- Probabilidade operacional: NAO AUTORIZADA
- Backtest operacional: NAO EXECUTADO / NAO AUTORIZADO

## Publicacao
O workflow em .github/workflows/pages.yml esta preparado para GitHub Pages.

## Módulo Opções V1
- entrada manual por texto copiado do CME QuickStrike;
- parser compartilhado entre Gold/MGC e Nasdaq/MNQ;
- PR, ATM, IV ATM, DTE, DP ±1/±2/±3, CW, PW, Call/Put/Net GEX, Gamma Flip e regime;
- histórico manual apenas no navegador;
- snapshots automáticos derivados em `riskdesk_options_snapshot` (Supabase, leitura pública e escrita apenas pelo coletor local com credencial server-side);
- coletor local em `collector/` com perfil persistente do QuickStrike;
- nenhum dado de opções alimenta GEN1, GEN2, Market State, macro, confluência, risco ou trading.
