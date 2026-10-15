# Coletor local de opções — Risk Desk

Este coletor é a Etapa 2 do módulo **Opções**. Ele usa o mesmo `options-core.js` da caixa manual, portanto não existe um segundo motor de cálculo.

## Segurança e isolamento
- não altera GEN1, GEN2, Market State, macro, confluência, risco ou Laranjinha;
- não armazene a service-role key no GitHub;
- a sessão do QuickStrike fica somente na pasta local `.quickstrike-profile`;
- os textos brutos coletados ficam em `collector/out` para auditoria local.

## Primeira configuração
1. Instale Node.js 20+.
2. Abra esta pasta e rode `npm install`.
3. Rode `npx playwright install chromium`.
4. Copie `config.example.json` para `config.json`.
5. Em cada ativo, cole a URL da **Pricing Sheet / Prices** e a URL da **matriz Open Interest / OI** já configuradas no CME QuickStrike.
6. Defina localmente a variável `SUPABASE_SERVICE_ROLE_KEY`. Nunca coloque essa chave no repositório.
7. Opcionalmente defina `SUPABASE_URL`; se omitida, o coletor usa o projeto Risk Desk atual.
8. Rode `npm run collect`.

Na primeira execução o navegador abre com um perfil persistente. Faça login no QuickStrike nessa janela. As próximas execuções reutilizam a sessão enquanto ela permanecer válida.

## O que o coletor faz
- abre Pricing Sheet de Gold e Nasdaq;
- lê o texto completo da página;
- percorre Page Up / Page Down da matriz de OI para ampliar a cadeia;
- executa o mesmo parser/cálculo da aba manual;
- impede publicação se a série da Pricing Sheet não coincidir com a primeira série da matriz;
- salva cópia local do texto e do JSON calculado;
- publica apenas os **resultados derivados** no Supabase `riskdesk_options_snapshot`.

A aba Opções do site consulta o snapshot mais recente a cada 60 segundos.

## Agendamento
Depois de validar alguns dias manualmente, use o Agendador de Tarefas do Windows para executar `npm run collect` no horário desejado. O projeto não cria agendamento automaticamente.

## Limitação conhecida
O QuickStrike é uma interface web e pode mudar o layout. O coletor evita seletores frágeis e usa principalmente texto da página + botões Page Up/Page Down, mas uma mudança estrutural relevante da CME pode exigir ajuste no coletor.
