# Risk Desk Terminal — V10 J6B

Frontend web do projeto Risk Desk Nasdaq V10.

## Backend
O site consulta diretamente o projeto Supabase externo **risk-desk** via publishable key + RLS.

## Abas
- Hoje
- Evento
- Macro
- Nasdaq
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
