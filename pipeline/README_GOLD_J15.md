# Risk Desk J15 — ponte independente de ouro MGC (NinjaTrader → Supabase → site)

## O que foi preparado

1. \`pipeline/RiskDeskGoldBridgeJ15.cs\`: indicador NinjaTrader 8 SOMENTE DADOS, para usar em um gráfico **MGC 1 minuto**. Registra uma linha CSV por barra confirmada no \`State.Realtime\`, contendo Open/Close/Volume e horário UTC carimbado no fim da barra. Não desenha ou envia ordens.
2. \`pipeline/riskdesk_gold_uploader_j15.py\`: lê o CSV e envia os dados para \`riskdesk_j15_gold_m1_closed_v1\`, privada, utilizando as variáveis de ambiente **já configuradas** para o Risk Desk no Windows. Não envia NQ ou outros ativos.
3. \`pipeline/start_riskdesk_gold_j15.ps1\`: comando de inicialização local do uploader, SEM criar nova tarefa do Windows automaticamente.
4. Supabase privado: sigma MGC 5/15/30/60 com 60 retornos M1 consecutivos e PR da sessão em 19h BRT / 09h30 ET com primeira abertura da vela M1. O PR não é reajustado. Os pontos da sigma mudam a cada janela móvel; as distâncias são separadas.
5. Risk Desk GitHub Pages: aba **Ouro** e resumo na aba **Hoje**. Resultado vazio/indisponível até haver MGC real.

## Configurar no computador UMA vez

**Não modifique o código ou os indicadores do Laranjinha.**

1. No NinjaTrader, abra um gráfico do contrato ativo **MGC** (por exemplo, \`MGC 12-26\` somente se estiver sendo negociado e seu provedor disponibilizar o contrato) e altere Data Series para **1 Minute**. Confirme que o gráfico atualiza e que a conexão do provedor fornece dados reais. Não misture o preço do MGC com XAUUSD.
2. Faça download do arquivo \`RiskDeskGoldBridgeJ15.cs\` do repositório. No Windows coloque-o em \`Documentos\\NinjaTrader 8\\bin\\Custom\\Indicators\` (ou abra o editor NinjaScript e incorpore o código). Abra **NinjaScript Editor**, pressione **F5 Compile** e procure \`RiskDeskGoldBridgeJ15\` na lista de indicadores. Não instale o arquivo como estratégia nem altere o Laranjinha.
3. Aplique o indicador a **um único gráfico MGC 1 minuto**. Não escolha 5 minutos, XAU, GC ou instrumento proxy. O indicador escreve em \`Documentos\\NinjaTrader 8\\LaranjinhaML\\Live\\RiskDeskGoldBridge_MGC_M1.csv\` por padrão. O relógio do PC e o fuso selecionado no NinjaTrader devem estar corretos.
4. Na máquina onde já funciona o uploader do Risk Desk, copie \`riskdesk_gold_uploader_j15.py\` e \`start_riskdesk_gold_j15.ps1\` para a mesma pasta. Execute o script PowerShell **no ambiente local que já fornece** \`RISKDESK_SUPABASE_URL\` e \`RISKDESK_SUPABASE_SECRET_KEY\`. Não coloque nenhuma chave no GitHub ou nas capturas de tela. Se usar DPAPI/autostart, a inicialização deve reutilizar o ambiente protegido existente.
5. No Supabase, verifique a tabela privada \`riskdesk_j15_gold_bridge_health_v1\` e \`riskdesk_j15_gold_m1_closed_v1\`: dados devem surgir a cada barra M1 concluída durante a negociação; a sigma aparecerá após 60 retornos consecutivos válidos. \`NO_RECENT_MARKET_BAR\` pode ser normal fora da sessão.
6. Entre em **Risk Desk > Ouro**; após os dados estarem ativos, surgirão σ5/15/30/60 e status. O PR será congelado somente se a ponte estiver funcionando durante a abertura; sem primeiro candle não se inventa um PR.
7. **Depois do teste local**, integrar o uploader ao **único** inicializador Windows existente, sem criar um segundo sistema de autostart e sem reiniciar NinjaTrader, MT5 ou o motor de trading. Esta integração local depende de teste no Windows e não foi executada pelo ChatGPT.

## Como funciona

- NinjaScript usa **Calculate.OnBarClose**, e somente \`State.Realtime\` (nunca reprocessa histórico NinjaTrader carregado como se fosse LIVE).
- Cada horário de barra M1 corresponde ao **fim da vela** do NinjaTrader.
- Registro traz abertura/fechamento, volume e horário de observação UTC, rejeitando sinais com mais de 3 minutos de atraso em relação ao candle.
- Uploader idempotente, credencial local, tabela privada, sinalizadores de qualidade.
- Sigma de ouro é desvio-padrão dos retornos log M1 ajustado para horizonte \`sqrt(5/15/30/60)\`, em **USD/oz de preço MGC**. Não é valor financeiro por contrato, DP/CME/IV nem VXN.
- Para a comparação com o dia anterior e 20–40 sessões por horário, será necessário coletar suficiente histórico M1 de MGC do mesmo contrato ou validar método de ajuste de rollover; os 10.290 registros CLEAN V8 são **histórico macro**, não candles de ouro.
- PR congelado: **Open da primeira barra M1 encerrada imediatamente após 19h Brasília e 09h30 Nova York**, quando capturada dentro da janela do evento. Independente do PR das opções.

## Limites e segurança

- O GitHub Pages é público. O preço exato do contrato e o PR ficam em tabelas privadas do Supabase, enquanto a página pública recebe apenas sigma derivada, movimento, data e qualidade; apresentação de cotações absolutas dependerá de área autenticada e permissão de dados.
- O uploader requer a mesma secret local do Risk Desk; não crie variáveis na página pública nem envie tokens para o chat.
- Não foram modificados nem recompilados: Laranjinha, J7A NQ/ZQ/ZT/ZN, GEN1/GEN2, Market State, opções/DP/CW/PW/GF/GEX, CLEAN V8.
- **Code reviewed, but runtime/compile verification was not available in this environment.**
