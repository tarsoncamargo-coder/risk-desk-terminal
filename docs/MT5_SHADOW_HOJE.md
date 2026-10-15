# Card ActivTrades MT5 / DXY sintético — SHADOW
Escopo: **visualização somente** na aba Hoje, sem integração ao motor de decisão do Risk Desk.

## Interface
- `mt5-shadow-hoje.js` + `mt5-shadow-hoje.css`, importados por `index.html`.
- Mostra EURUSD, USDJPY, GBPUSD, USDCAD, USDSEK, USDCHF e DXY sintético.
- Consulta exclusivamente `public.riskdesk_mt5_fx_shadow` via API do site.
- Não publica preços fictícios e indica coleta ausente/antiga. Atualização a cada 15 s.
- Não toca J7B, J7D, J7E, J11, J12, GEN1, GEN2 ou `live_market_minute`.
- Cotações "RECENT" significam apenas ticks recentes pelo relógio corrigido; não comprovam ausência de delay do provedor.

## Backend ainda NÃO ativado
- O arquivo `docs/schema_mt5_fx_shadow.sql` é **proposta**, não foi executado.
- Antes de aparecerem valores reais, será necessária autorização de criação da tabela, RLS e envio SHADOW pelo coletor local.
- Acesso público SELECT (anon) é proposital para GitHub Pages; escrita permitida somente a `service_role`.
- Não armazenar chave de serviço no JS, GitHub, screenshots ou conversa. O coletor usa chave em variável local do Windows e o endereço `https://pkmjknlbsptqhanejddm.supabase.co`.
- O arquivo Python de teste é `riskdesk_mt5_activtrades_shadow.py` (disponibilizado separadamente para execução no Windows após teste de instalação). No modo padrão cria `%LOCALAPPDATA%\\RiskDesk_MT5_Teste\\shadow\\mt5_shadow_ultimo.json` e `mt5_shadow_amostras.jsonl` por 60 minutos, sem envio remoto.

## Critério de validação
- MT5 correto ActivTrades conectado.
- Seis pares simultâneos, offsets horários inteiros calculados por consenso; rejeitar offset inconsistente.
- DXY calculado pela fórmula da ICE usando mid bid/ask; sincronização máxima 5 s e idade máxima 15 s nos seis pares.
- Na interface, idade da amostra acima de 90 s indica dados antigos (não LIVE).
- Comparação TradingView pontual de preços não comprova delay; teste de evento e relógio independente continuam pendentes.

## Ativação
1. Testar coletor **somente local** e revisar os logs.
2. Autorizar e aplicar schema SHADOW (apenas tabela nova).
3. Habilitar publicação SHADOW com credenciais locais, sem mexer em motores.
4. Revisar PR, fazer merge e validar card em produção.

Sem ordens e sem recomendações operacionais.
