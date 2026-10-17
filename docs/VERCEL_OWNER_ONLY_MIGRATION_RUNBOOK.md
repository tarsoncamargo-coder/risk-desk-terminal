# Risk Desk — migração Vercel com proprietário único (PREPARAÇÃO, sem corte)

## Autorização e limites
Em 17/10/2026, o proprietário confirmou **uso exclusivamente pessoal** e autorizou **preparar a migração preservando o site existente até aprovação da substituição**. Isto NÃO autoriza merge, Production deploy, mudar visibilidade do GitHub, desativar Pages, expor endpoint, alterar RLS/grants, criar conta pessoal, armazenar segredos ou cortar o site atual.

## Inventário confirmado (read-only)
- GitHub `tarsoncamargo-coder/risk-desk-terminal`: **public**, branch de produção `main`; nove abas.
- Workflow `.github/workflows/pages.yml` publica GitHub Pages no push de `main`. **Não desativar na preparação.**
- `app.js` estático consulta Supabase PostgREST `/rest/v1/` pelo navegador, com chave pública. Proteger só a URL Vercel não transforma essas consultas em API privada.
- Vercel `risk-desk-v11-preview-20261013`, projeto `prj_eduKcALxBpRADaSfV8KLqZSrYOF8`: SSO configurado `all_except_custom_domains`, preview do PR #13, `live=false` na última verificação. Acesso de membros da equipe não pôde ser auditado (403); não afirmar exclusividade já comprovada.
- Supabase `pkmjknlbsptqhanejddm`: J14C interno não permite SELECT para `anon` nem `authenticated`; `auth.users` tinha **0** registros na inspeção. Sem allowlist validada.
- Os dados macro 15m NQ/ZT/ZN/DXY_MT5 estão em pesquisa, sanitizador puro offline. **Nenhuma rota HTTP ou GRANT implantados.**

## Arquitetura-alvo (não ativada)
Navegador autorizado → Vercel protegida → sessão assinada e verificada no servidor → correspondência exata com UID do proprietário → API same-origin com `Cache-Control: private, no-store` → consulta privada de privilégio mínimo e sanitização → pesquisa com origem, data, validade; sem preços brutos ou sinal operacional. Segredos apenas server-side. Não confiar em header de usuário, email inserido pelo navegador, URL desconhecida nem só no SSO da equipe Vercel.

## Gates prévios obrigatórios
1. Confirmar permissões/licenças de exibição pessoal e derivados NinjaTrader/CME e MT5; uso pessoal não é automaticamente isento.
2. Auditar membros/autorização do workspace Vercel. Criar **uma** identidade Supabase Auth verificada com autorização futura separada; nunca imprimir ou commitar email/UID.
3. Testar respostas `401` visitante, `403` outra identidade, `503` falta de configuração, `200` só proprietário; revogação, expiração, limitação de chamadas, ausência de CORS público, logs sem segredos.
4. Testar dados válidos, atraso, zero falso, replay, DST, 5min e qualidade; manter J14C privada e um único PR ativo; HISTÓRICO ≠ LIVE.
5. Homologar as nove abas (Hoje, Evento, Leitura diária, Macro, Nasdaq, Ouro, Opções, Histórico/Backtest, Sistema) em navegador autenticado e anônimo; responsividade e backup/rollback.
6. Conferir escopo Vercel projeto/branch/commit/variáveis **por nomes apenas**; build READY isolado não prova operação privada.

## Corte FUTURO — bloqueado até nova aprovação explícita
- **Nunca mesclar PR #13 diretamente em `main` com Pages publicando.** Isso exporia a nova versão pelo site antigo.
- Com licença, autorização owner-only, rota privada, backup/rollback, testes e aprovação final: planejar janela; impedir publicações pelo Pages e restringir visibilidade pública do repositório conforme autorizado; só então habilitar Vercel Production em `main`, mantendo SSO/autorização. Validar acesso anônimo NEGADO e login pessoal com todas as abas e fontes.
- Se a verificação falhar, não ampliar acesso, não expor chaves, não declarar concluído; acionar rollback testado. Reabrir Pages público também exige aprovação do proprietário.

## Auditoria CI de preparação
```bash
node --check ops/private-cutover-audit.cjs
node tests/private-cutover-audit.test.cjs
node ops/private-cutover-audit.cjs --expect-parallel
```

O resultado `PREPARATION_ONLY` significa: os nove menus e o site legado não foram desativados. **Não prova sigilo nem liberação para corte.** `--require-private-cutover` é fail-closed. Verificações de identidade, licença e runtime ainda estão pendentes.

**Nenhuma mutação Supabase, merge, Production deploy ou mudança de GitHub Pages/visibilidade nesta etapa.**
