# J14C macro 15m — contrato server-side (PROPOSTA; DESATIVADO)

## Decisão de acesso — proprietário único (17/10/2026)
- Requisito confirmado: **somente o proprietário utiliza o Risk Desk**, sem acesso de convidados.
- Vercel preview com SSO: verificado, mas a configuração não autoriza automaticamente chamadas anônimas ao Supabase nem identifica um proprietário dentro da API.
- GitHub `tarsoncamargo-coder/risk-desk-terminal`: visibilidade atual **public**. A hospedagem GitHub Pages e arquivos estáticos públicos não atendem, sozinhos, ao objetivo de acesso exclusivo. Alterar visibilidade do repositório/desativar Pages exige aprovação explícita e checagem dos efeitos de hospedagem.
- Supabase projeto `pkmjknlbsptqhanejddm`: na verificação read-only de 17/10, `auth.users` tinha **0** registros; nenhuma identidade própria para allowlist está cadastrada. Não assumir e-mail/UID do proprietário; não criar login por conta própria.
- `anon` e `authenticated` **não** possuem SELECT no snapshot privado J14C. Manter assim. O login de um só usuário não é justificativa para abrir grants.
- Para ativação: cadastrar **uma** identidade Supabase Auth validada (por exemplo link de e-mail), definir o `auth.uid()` proprietário em configuração restrita e exigir credencial verificada no endpoint/Edge Function. Exigir coincidência exata com o UID autorizado; qualquer outra identidade recebe 403. Não confiar em `X-User`, e-mail informado pelo cliente ou claims sem assinatura verificada.
- Chaves privilegiadas (se realmente necessárias) apenas no servidor, nunca no GitHub, páginas estáticas, JS do browser, screenshots ou links. Endpoints protegidos não podem aceitar diretamente `anon` ou segredo compartilhado no frontend.
- Como o site é uma aplicação estática com publicação também por GitHub Pages, **não habilitar a chamada client-side** a endpoints proprietários antes de decidir a migração de hospedagem privada. Não confiar apenas na obscuridade do domínio da Vercel.
- Manter a política de licenciamento/direitos das fontes e derivados como pré-requisito independente, mesmo para uso individual.

### Ordem de implementação proposta (sem autorização de produção)
1. Revisar autorização do usuário para restringir acesso público ao código/Páginas e confirmar efeitos sobre links atuais.
2. Criar/validar login pessoal sem expor identificadores no repositório; ativar autenticação e autorização em ambiente de teste.
3. Disponibilizar rota privada com controle de sessão verificada, allowlist por UID, filtro J14C, `Cache-Control: private, no-store`, sem CORS público e sem preços brutos.
4. Testar 401 anônimo, 403 usuário diferente, 200 proprietário, sessão revogada/expirada, 503 configuração incompleta e freshness/zero inválido.
5. Somente após validação de licença e autorização expressa, promover as alterações necessárias à hospedagem e ao banco.

**Estado:** contrato owner-only documentado; login, rota e migração de visibilidade NÃO ativados.

**Escopo:** pesquisa privada no Risk Desk. Não há rota HTTP, função Supabase, GRANT, segredo ou deploy em produção incluídos neste conjunto.

## Diagnóstico verificado
- O site estático utiliza PostgREST do Supabase com chave pública e RLS; também possui publicação GitHub Pages. Proteção SSO da prévia Vercel não substitui autenticação de uma API.
- O snapshot J14C original é privado: anon não possui SELECT, RLS permanece ligado, sem políticas liberando a tabela.
- NQ, ZT e ZN: percentuais 15min por NinjaTrader; DXY_MT5: MT5 shadow, **não confundir com Yahoo DXY**.
- Na tabela de origem, retornos iguais a 0 podem acompanhar MARKET_BAR_STALE. Apenas FRESH_15M_COMPARABLE com relógios válidos libera um zero real.
- Dados CME e produtos derivados exigem validação do escopo de uso/licença antes de distribuição.

## Pacote
- ops/macro15m-sanitizer.cjs: sanitizador puro, sem rede. Converte somente 4 percentuais de 15m para objetos tipados, aceita 0 apenas com qualidade comprovada, rejeita origem, data, risco de look-ahead, replay, inválidos e frescor > 6 min.
- tests/macro15m-sanitizer.test.cjs: 9 cenários SINTÉTICOS, sem cotações reais e sem credenciais.

## Requisitos para habilitar no futuro
1. Confirmar direitos de exibição de percentuais derivados NQ/ZT/ZN e DXY_MT5 para os usuários finais pretendidos.
2. Implementar autenticação/autorizações individuais no backend; não confiar só em Vercel preview SSO, anon key ou URL obscura.
3. Criar função/visão privada auditada e role com privilégios mínimos; não conceder SELECT na tabela J14C a anon/authenticated.
4. Endpoint same-origin, sem CORS aberto e com segredos somente server-side; validar autenticação ANTES de leitura; depois executar sanitização.
5. HTTP 401 (sem login), 403 (sem permissão), 503 (sem configuração) e 200 somente com resultado validado, Cache-Control private/no-store, rate-limit e logs sem credenciais/preços.
6. Cliente deve permanecer com travessões até que o endpoint esteja autorizado e homologado; sem fallback para snapshots internos. Medidas de DR/PR/IV/DP/opções não são derivadas destes percentuais.
7. Teste E2E de sessão autorizada, anônima, expirando, atrasada, relógio 5min, DST, retorno 0 válido e quality reject. Checar também o site PUBLICADO em GitHub Pages, não apenas a prévia protegida Vercel.

**Importante:** o SQL candidato previamente criado com security_invoker=true e sem GRANT não funciona por simples consulta client-side. O invocador autorizado precisará de acesso avaliado e revisto.

### Execução local
node --check ops/macro15m-sanitizer.cjs
node tests/macro15m-sanitizer.test.cjs

**Nada foi ativado no banco.** Não converter a validação de código em alegação de validação de API/ambiente real.