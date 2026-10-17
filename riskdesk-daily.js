/* Leitura diária integrada: somente consultas públicas saneadas, sem sinal operacional. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const ok=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
const num=(v,d=2)=>ok(v)?Number(v).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d}):"—";
const sign=v=>ok(v)?(Number(v)>0?"↑ +":Number(v)<0?"↓ ":"→ ")+num(v,2):"—";
const stamp=v=>{const t=Date.parse(v||"");return Number.isFinite(t)?new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"}).format(t):"—"};
const recent=(v,m=6)=>{const t=Date.parse(v||"");return Number.isFinite(t)&&(Date.now()-t)/60000>=-2&&(Date.now()-t)/60000<=m};
// Relógio regular dos futuros CME Globex (NY): fechamento sexta 17h ET,
// reabertura domingo 18h ET; pausas diárias 17–18h ET.
// DST aplicado pela zona America/New_York. Exceções/feriados exigem calendário externo.
const futuresGlobexRegularClosed=(at=new Date())=>{
 const parts=Object.fromEntries(
  new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"short",hour:"2-digit",hourCycle:"h23"})
   .formatToParts(at).filter(x=>x.type==="weekday"||x.type==="hour").map(x=>[x.type,x.value]));
 const d=parts.weekday,h=Number(parts.hour);
 return d==="Sat"||(d==="Sun"&&h<18)||(d==="Fri"&&h>=17)||
  (["Mon","Tue","Wed","Thu"].includes(d)&&h>=17&&h<18);
};
const put=(id,s)=>{if($(id))$(id).textContent=s};
const mk=(tag,cl,txt)=>{const e=document.createElement(tag);e.className=cl;e.textContent=txt;return e};
const request=(table,params)=>api(table,params).then(v=>Array.isArray(v)?v:[]);
const radarFilters={macro:"all"};
const alertStates=/ATRASAD|INVÁLID|INDISPON|FORA SESS|SEM FONTE|PENDENTE|RESTRITO/i;
const availableStates=/TEÓRICO|ATUALIZADO|CONTEXTO|HISTÓRICO|DIÁRIO|PESQUISA/i;
const sources=[
 ["context","riskdesk_j14c_context_site_v1","select=*&limit=1"],
 ["nqSigma","riskdesk_j14k_sigma_research_site_v1","select=*&limit=1"],
 ["nqPR","riskdesk_j14l_anchor_context_site_v1","select=*&order=last_updated_at_utc.desc&limit=5"],
 ["goldSigma","riskdesk_j15_gold_sigma_site_v1","select=*&limit=1"],
 ["goldPR","riskdesk_j15_gold_pr_site_v1","select=*&order=anchor_minute_utc.desc&limit=5"],
 ["health","riskdesk_j14a_live_health_site_v1","select=*&order=sort_index.asc&limit=25"],
 ["fed","riskdesk_j14e_zq_weighted_site_v1","select=*&order=month_first.asc&limit=2"],
 ["globexBench","riskdesk_sigma_globex_research_cache_site_v3","select=*&limit=2"],

];
function statusTone(value){
 const s=String(value||"").toUpperCase();
 if(!s||s==="—")return "neutral";
 if(/STALE|NOT_60|PENDING|WARM|INDETERMIN|AGUARDANDO|RECONSTRUCT|PARTIAL|ATRASAD|FORA SESS|TEÓRICO|PENDENTE|HISTÓRICO/.test(s))return "warning";
 if(/UNAVAILABLE|ERROR|FAIL|MISSING|SEM LEITURA|NÃO VALIDADO|INDISPONÍVEL|INVÁLIDO|RESTRITO/.test(s))return "negative";
 if(/READY|PASS|OK|VALID|RECENT|CAPTURADO|CONGELADO|ATUALIZADO|CONTEXTO/.test(s))return "positive";
 return "neutral";
}
function numberTone(value){
 if(!Number.isFinite(Number(value)))return "neutral";
 return Number(value)>0?"up":Number(value)<0?"down":"neutral";
}
function light(tone){return mk("span","rd-daily-light rd-daily-light--"+tone,"");}
function card(host,title,sub,items){
 const root=$(host);if(!root)return;root.replaceChildren();
 const head=mk("div","rd-daily-head","");
 head.append(mk("div","rd-daily-title",title),mk("span","rd-daily-pill","PESQUISA"));
 root.append(head,mk("div","rd-daily-muted rd-daily-description",sub));
 const grid=mk("div","rd-daily-grid","");
 for(const [label,value,detail] of items){
  const movement=/^Distância desde PR$/.test(label);
  const tone=movement&&String(value)!=="—"?numberTone(String(value).replace(/[^0-9,.-]/g,"").replace(",", ".")):statusTone(value);
  const cell=mk("article","rd-daily-cell rd-daily-cell--"+tone,"");
  const top=mk("div","rd-daily-cell-top","");
  top.append(light(tone),mk("div","rd-daily-label",label));
  const val=mk("div","rd-daily-value","");
  if(movement&&String(value)!=="—"){val.append(mk("span","rd-daily-arrow",String(value).startsWith("↑")?"↑":String(value).startsWith("↓")?"↓":"→"));}
  val.append(document.createTextNode(movement?String(value).replace(/^[↑↓→]\\s*/,""):String(value)));
  cell.append(top,val,mk("div","rd-daily-muted",detail||""));grid.append(cell);
 }
 root.append(grid);
}
function renderTable(host,title,rows,foot){
 const root=$(host);if(!root)return;root.replaceChildren();
 root.append(mk("div","rd-daily-title",title));
 const isMacro=host==="rdDailyMacro";
 if(isMacro){
  const tools=mk("div","rd-terminal-filterbar","");
  tools.append(mk("span","rd-terminal-filterlabel","MOSTRAR"));
  for(const [mode,label] of [["all","Todos"],["alert","Alertas"],["available","Disponíveis"]]){
   const btn=mk("button","rd-terminal-filter"+(radarFilters.macro===mode?" is-active":""),label);
   btn.type="button";
   btn.setAttribute("aria-pressed",String(radarFilters.macro===mode));
   btn.addEventListener("click",()=>{radarFilters.macro=mode;renderTable(host,title,rows,foot);});
   tools.append(btn);
  }
  root.append(tools);
 }
 const visibleRows=isMacro?rows.filter(r=>radarFilters.macro==="all"||
   radarFilters.macro==="alert"&&alertStates.test(String(r[5]))||
   radarFilters.macro==="available"&&availableStates.test(String(r[5]))):rows;
 const wrap=mk("div","rd-daily-scroll","");
 const table=mk("table","rd-radar-table","");
 const thead=mk("thead","","");const trh=mk("tr","","");
 ["Ativo","Valor","Variação","%","Direção","Status"].forEach(v=>trh.append(mk("th","",v)));
 thead.append(trh);table.append(thead);const body=mk("tbody","","");
 for(const row of visibleRows){
  const tr=mk("tr","","");
  const [name,value,change,pc,direction,status,age]=row;
  const dir=typeof direction==="number"?(direction>0?"↑":direction<0?"↓":"→"):"—";
  const tone=dir==="↑"?"up":dir==="↓"?"down":dir==="→"?"flat":"missing";
  [[name,"rd-radar-name"],[value,"rd-radar-number"],[change,"rd-radar-number"],[pc,"rd-radar-number"],[dir,"rd-radar-direction rd-radar-direction--"+tone],[status,"rd-radar-status rd-radar-status--"+statusTone(status)]].forEach(([value,cl])=>tr.append(mk("td",cl,String(value))));
  if(age)tr.title=age;
  body.append(tr);
 }
 if(!visibleRows.length){
  const td=mk("td","rd-radar-empty","Nenhum ativo neste filtro. Selecione Todos para ver todas as fontes.");
  td.colSpan=6;
  const emptyTr=mk("tr","","");emptyTr.append(td);body.append(emptyTr);
 }
 table.append(body);wrap.append(table);root.append(wrap);
 if(isMacro)root.append(mk("div","rd-terminal-resultcount",
   visibleRows.length+" de "+rows.length+" linhas · filtro: "+
   ({all:"todos",alert:"alertas",available:"disponíveis"}[radarFilters.macro])));
 if(foot)root.append(mk("div","rd-daily-muted",foot));
}
function tableNum(x,d=2){return ok(x)?num(x,d):"—"}
function changePct(x){return ok(x)?(Number(x)>0?"+":"")+num(x,3)+"%":"—"}
function statusFrom(ts,other){if(!other)return "Indisponível";if(!ts)return "Contexto";return recent(ts)?"Atualizado":"Atrasado"}
function show(data,errors){
 const c=data.context?.[0],ns=data.nqSigma?.[0],nq=(data.nqPR||[]).find(x=>x.asset==="NQ"&&x.price_reference_is_frozen);
 const benchmarks=data.globexBench||[],nqHist=benchmarks.find(x=>x.asset==="NQ"),goldHist=benchmarks.find(x=>x.asset==="MGC");
 // Histórico V3 é uma referência imutável da sessão/horário registrado e não depende de
 // nova cotação M1 nem do cron continuar rodando após o fechamento de sexta.
 // A razão de expansão LIVE mantém gates próprios de frescor/qualidade abaixo.
 const benchReady=x=>x?.data_regime==="HISTORICO_M1_GLOBEX_V3_PESQUISA"&&
   x?.trading_authorized===false&&
   /^\d{4}-\d{2}-\d{2}$/.test(String(x?.asof_globex_session_date||""))&&
   x?.asof_globex_session_date===x?.live_globex_session_date&&
   Number(x?.comparable_globex_sessions)>=20&&
   ok(x?.median_15m_points)&&Number(x.median_15m_points)>0&&
   ok(x?.p75_15m_points)&&Number(x.p75_15m_points)>=Number(x.median_15m_points)&&
   ok(x?.p90_15m_points)&&Number(x.p90_15m_points)>=Number(x.p75_15m_points)&&
   ok(x?.previous_sigma15_points)&&Number(x.previous_sigma15_points)>0;
 const historicLabel=x=>"Histórico"+(x?.comparison_clock_brt?" "+x.comparison_clock_brt:"");
 const historicExplanation=x=>x?
   ("HISTÓRICO · base "+(x.asof_globex_session_date||"—")+
   " · fechamento "+(x.comparison_clock_brt||"—")+" BRT · "+
   (x.historical_contract||"—")+" · última atualização "+
   stamp(x.refreshed_at_utc)):
   "Cache histórico V3 não recebido. Verifique a requisição de benchmarks no navegador.";
 const benchRatioReady=x=>benchReady(x)&&recent(x?.refreshed_at_utc,3)&&((x.asset==="MGC"&&x.research_status==="HISTORICAL_RESEARCH_COMPARISON_READY")||(x.asset==="NQ"&&x.research_status==="MNQ_PROXY_RESEARCH_COMPARISON_READY"&&x.historical_provenance==="MNQ_PROXY_RESEARCH_QA_199_WINDOWS_NONOPERATIVE"))&&recent(x?.live_bar_minute_utc,6)&&ok(x?.expansion_ratio);
 const benchInfo=x=>!x?"Referência M1 V3 não consultada":x.research_status==="BASELINE_V3_ASOF_SESSION_MISSING"?"HISTÓRICO V3 DESATUALIZADO: importar novos M1 para a sessão "+(x.live_globex_session_date||"—"):x.asset==="NQ"?"Proxy MNQ "+(x.historical_contract||"")+" · "+Number(x.comparable_globex_sessions||0)+" sessões anteriores · QA 199 janelas, p95 9,04% · somente pesquisa · base "+(x.asof_globex_session_date||"—"):(Number(x.comparable_globex_sessions||0)+" sessões anteriores · faixa "+(x.comparison_clock_brt||"—")+" BRT · "+(x.historical_contract||"")+" · base "+(x.asof_globex_session_date||"—")+" · V3 pesquisa");
 const percentileInfo=x=>benchReady(x)?("P75: ±"+num(x.p75_15m_points)+" pts · P90: ±"+num(x.p90_15m_points)+" pts · pesquisa histórica · referência "+(x.asof_globex_session_date||"—")+" às "+(x.comparison_clock_brt||"—")+" BRT"):"Sem percentis Globex validados neste contrato";
 const overview=$("rdDailyHistoricalOverview");
 if(overview){
  overview.replaceChildren();
  for(const [label,x,isGold] of [["NASDAQ · PROXY MNQ",nqHist,false],["OURO · MGC",goldHist,true]]){
   const article=mk("article","rd-hist-card "+(isGold?"rd-hist-card--gold":"rd-hist-card--nq"),"");
   const head=mk("div","rd-hist-card-head","");
   head.append(mk("strong","",label),
    mk("span","rd-hist-classification",benchReady(x)?"HISTÓRICO":"SEM REFERÊNCIA"));
   article.append(head);
   if(benchReady(x)){
    const metrics=mk("div","rd-hist-metrics","");
    for(const [label,value] of [["σ anterior",x.previous_sigma15_points],["Mediana",x.median_15m_points],["P75",x.p75_15m_points],["P90",x.p90_15m_points]]){
     const metric=mk("div","rd-hist-metric","");
     metric.append(mk("span","",label),mk("strong","", "±"+num(value)+" pts"));
     metrics.append(metric);
    }
    article.append(metrics);
    article.append(mk("p","rd-hist-provenance",
     "Base "+x.asof_globex_session_date+" · "+(x.comparison_clock_brt||"—")+
     " BRT · "+Number(x.comparable_globex_sessions)+" sessões · "+
     (x.historical_contract||"—")+(isGold?" · mesmo contrato":" · proxy de pesquisa, não NQ")));
   }else{
    article.append(mk("p","rd-hist-empty",benchInfo(x)+" · Nenhum valor histórico apresentado sem auditoria válida."));
   }
   overview.append(article);
  }
 }


 const gs=data.goldSigma?.[0],gold=(data.goldPR||[]).find(x=>x.reference_locked),fed=data.fed?.[0];
 const nqGood=/PASS|READY|OK/.test(String(ns?.quality_status||"").toUpperCase())&&recent(ns?.source_minute_utc)&&Number(ns?.contiguous_returns_60m)>=60&&ok(ns?.sigma_60m_points);
 const goldGood=gs?.source_state==="MGC_CLOSED_M1_SIGMA_RESEARCH_QUALITY_PASS"&&recent(gs?.source_last_minute_utc)&&ok(gs.sigma_60m_points);
 const nqIsHistorical=String(nq?.status||"").includes("HISTORICAL_PR_RECONSTRUCTION");
 const nqFresh=!nqIsHistorical&&nq?.fresh_data===true&&recent(nq.market_timestamp_utc);
 const goldFresh=gold?.freshness==="REFERENCE_FROZEN_AND_BAR_RECENT"&&recent(gold.market_bar_minute_utc);
 // Variações J14C de 15m pertencem a snapshots internos não publicados no Data API.
 // Nunca inferir os percentuais do estado de saúde ou de séries não sincronizadas.
 const macroContextRecent=recent(c?.assessed_at_utc,6);
 const futuresClosed=futuresGlobexRegularClosed();
 const healthByKey=new Map((data.health||[]).map(x=>[x.item_key,x]));
 const marketHealth=k=>{
  const h=healthByKey.get(k);
  if(!h)return "Sem fonte";
  const status=String(h.diagnostic_status||"").toUpperCase();
  if(status.includes("OUTSIDE_EXPECTED")||status.includes("FORA_SESSAO"))return "Fora sessão";
  if(status.includes("FAILED")||status.includes("INVALID"))return "Inválido";
  if(status.includes("STALE")||status.includes("DELAYED"))
   return futuresClosed&&["ASSET_NQ","ASSET_ZT","ASSET_ZN"].includes(k)?"Fora sessão":"Atrasado";
  if(status.includes("FRESH")||status.includes("OK"))return "Contexto";
  return "Sem leitura";
 };
 const nqExpansion=benchRatioReady(nqHist)?Number(nqHist.expansion_ratio):null;
 const goldExpansion=benchRatioReady(goldHist)?Number(goldHist.expansion_ratio):null;
 const formatExpansion=v=>v===null?"SEM COMPARAÇÃO":(num(v,2)+"× · "+(v>=1.25?"EXPANSÃO":v<0.8?"COMPRESSÃO":"FAIXA USUAL"));
 const coverageOk=macroContextRecent&&String(c?.research_data_status||"").toUpperCase().includes("READY");
 put("rdDailyMacroState",!macroContextRecent||!c?.fresh_sources?
  (futuresClosed?"FUTUROS FECHADOS":"SEM DADOS FRESCOS"):
  (c.fresh_sources||0)+"/"+(c.total_sources||4)+" FONTES FRESCAS");
 put("rdDailyNqState",nqGood&&ok(ns?.sigma_15m_points)?"σ15 ±"+num(ns.sigma_15m_points)+" pts":
  futuresClosed?"MERCADO FECHADO":"SIGMA INDISPONÍVEL");
 put("rdDailyGoldState",goldGood&&ok(gs?.sigma_15m_points)?"σ15 ±"+num(gs.sigma_15m_points)+" pts":
  futuresClosed?"MERCADO FECHADO":"SIGMA INDISPONÍVEL");
 put("rdDailyNqDetail",futuresClosed&&!nqGood?"Sem sigma LIVE · histórico MNQ proxy disponível para pesquisa":
  formatExpansion(nqExpansion)+" · histórico MNQ proxy / pesquisa");
 put("rdDailyGoldDetail",futuresClosed&&!goldGood?"Sem sigma LIVE · histórico MGC disponível para pesquisa":
  formatExpansion(goldExpansion)+" · histórico MGC / pesquisa");
 const mkHealthRow=(label,k)=>[label,"—","—","—",null,marketHealth(k),"Fonte: "+(healthByKey.get(k)?.source_name||"não identificada")+" · "+(healthByKey.get(k)?.explanation_pt||"sem delta 15m saneado")];
 const fedProjection=recent(fed?.calculated_at_utc,1440)&&
    fed?.source==="NYFED_EFFR_CALENDAR_WEIGHTED_PROJECTION"&&
    fed?.operational_use_authorized===false&&
    ok(fed?.zq_flat_weighted)&&
    String(fed?.quality_status||"").startsWith("DAY_WEIGHTED_");
 const macroRows=[
  mkHealthRow("NQ · futuro Nasdaq","ASSET_NQ"),
  mkHealthRow("ZT · futuro Treasury 2Y","ASSET_ZT"),
  mkHealthRow("ZN · futuro Treasury 10Y","ASSET_ZN"),
  mkHealthRow("DXY · índice do dólar","ASSET_DXY"),
  ["ZQ sintético · manutenção",fedProjection?num(fed.zq_flat_weighted,4):"—","—","—",null,fedProjection?"Teórico":"Indisponível","Cenário ponderado NY Fed/EFFR, não uma cotação negociada"],
  ["ZQ sintético · corte 25pb",fedProjection&&ok(fed.zq_cut25_weighted)?num(fed.zq_cut25_weighted,4):"—","—","—",null,fedProjection?"Teórico":"Indisponível","Hipótese de corte, não probabilidade FedWatch"],
  ["ZQ sintético · alta 25pb",fedProjection&&ok(fed.zq_hike25_weighted)?num(fed.zq_hike25_weighted,4):"—","—","—",null,fedProjection?"Teórico":"Indisponível","Hipótese de alta, não probabilidade FedWatch"],
  ["ZQ negociado · settlement",fed?.official_settlement_verified&&ok(fed.cme_daily_settlement)?num(fed.cme_daily_settlement,4):"—","—","—",null,fed?.official_settlement_verified?"Diário":"Indisponível","Somente settlement CME verificado; nunca substituir por ZQ teórico"],
  mkHealthRow("VXN · IV Nasdaq","ASSET_VXN"),
  mkHealthRow("VIX · IV S&P 500","ASSET_VIX")
 ];
 renderTable("rdDailyMacro","RADAR MACRO · COBERTURA E CENÁRIOS",macroRows,"Variações de 15 minutos e cotações de NQ, ZT, ZN e DXY ainda não estão publicadas na API saneada. Estado da fonte não substitui variação de preço. ZT/ZN são preços de futuros, não yields. ZQ sintético é uma projeção ponderada, não um settlement negociado.");
 const mkSigma=(x,k,good)=>["σ "+k+"m",good?("±"+num(x?.["sigma_"+k+"m_points"])+" pts"):"—","—","—","—",good?"Atualizado":futuresClosed?"Fora sessão":"Indisponível","Sigma realizada LIVE, não IV"];
 const histRow=(label,x,value,detail)=>{
  const valid=benchReady(x)&&ok(value);
  return [label,valid?"±"+num(value)+" pts":"—","—","—",null,
   valid?historicLabel(x):"Sem referência",
   valid?(historicExplanation(x)+" · "+(detail||benchInfo(x))):benchInfo(x)];
 };
 const nqRows=[...([5,15,30,60].map(k=>mkSigma(ns,k,nqGood))),
 ["Preço atual do NQ","—","—","—","—","Restrito","Cotação bruta não redistribuída nesta API pública"],
 ["Bandas desde PR · ±σ15","—","—","—","—","Pendente","Exigem PR absoluto autorizado e sigma congelada no instante da captura"],
 ["PR congelado",nqIsHistorical?"Reconstruído":nq?.price_reference_is_frozen?"Congelado":"—","—","—","—",nqIsHistorical?"Histórico":nqFresh?"Contexto":nq?"Atrasado":"Indisponível",nq?.status||""],
 ["Distância do PR",nqFresh?((Number(nq.movement_since_reference_points)>0?"+":"")+num(nq.movement_since_reference_points)+" pts"):"—",nqFresh?num(nq.movement_since_reference_points)+" pts":"—",nqFresh?changePct(nq.movement_since_reference_pct):"—",nqFresh?Number(nq.movement_since_reference_points):null,nqFresh?"Atualizado":"Atrasado",""],
 ["Múltiplos σ15 / σ60",nqFresh&&nqGood&&ok(nq.travelled_current_sigma15)&&ok(nq.travelled_current_sigma60)?num(nq.travelled_current_sigma15)+" / "+num(nq.travelled_current_sigma60):"—","—","—","—",nqFresh&&nqGood?"Contexto":"Indisponível",""],
 ["σ anterior · mesmo horário",benchReady(nqHist)&&ok(nqHist.previous_sigma15_points)?"±"+num(nqHist.previous_sigma15_points)+" pts":"—","—","—","—",benchReady(nqHist)?historicLabel(nqHist):"Sem referência",nqHist?.previous_globex_session_date?(nqHist.previous_globex_session_date+" · MNQ proxy histórico, não NQ"):"Sessão anterior ainda não importada"],
 histRow("σ mediana histórica · horário",nqHist,nqHist?.median_15m_points,benchInfo(nqHist)),
 histRow("σ P75 histórica · horário",nqHist,nqHist?.p75_15m_points,"Percentil 75 · MNQ proxy · 20–40 sessões · pesquisa"),
 histRow("σ P90 histórica · horário",nqHist,nqHist?.p90_15m_points,"Percentil 90 · MNQ proxy · 20–40 sessões · pesquisa"),
 ["Expansão / compressão",nqGood?String(ns.volatility_regime||"INDETERMINADO").replaceAll("_"," "):"—","—","—","—",nqGood?"Contexto":"Indisponível","Regime relativo atual; não é índice histórico"],
 ["Índice expansão vs. mediana · proxy MNQ",benchRatioReady(nqHist)?num(nqHist.expansion_ratio)+"×":"—","—","—","—",benchRatioReady(nqHist)?"Pesquisa":benchReady(nqHist)?"Aguardando LIVE":"Sem referência",percentileInfo(nqHist)]
 ];
 renderTable("rdDailyNasdaq","RADAR NASDAQ · NQ",nqRows,"Histórico MNQ V3: proxy QA por 199 comparações de σ15 (p95 9,04%). Índice apenas de pesquisa em fechamento alinhado de 5 minutos; não autorizado para trading. Volatilidade LIVE: "+(nqGood?String(ns.volatility_regime||"Indeterminada").replaceAll("_"," "):"sem amostra atual")+" · Macro: "+(c?.research_data_status||"sem validação"));
 const gRows=[...([5,15,30,60].map(k=>mkSigma(gs,k,goldGood))),
 ["Preço atual do MGC","—","—","—","—","Restrito","Cotação bruta não redistribuída nesta API pública"],
 ["Bandas desde PR · ±σ15","—","—","—","—","Pendente","Exigem PR absoluto autorizado e sigma congelada no instante da captura"],
 ["PR congelado",gold?.reference_locked?"Congelado":"—","—","—","—",goldFresh?"Contexto":gold?"Atrasado":"Indisponível",gold?.session_code||""],
 ["Distância do PR",goldFresh?((Number(gold.last_movement_usd_per_oz)>0?"+":"")+num(gold.last_movement_usd_per_oz)+" pts"):"—",goldFresh?num(gold.last_movement_usd_per_oz)+" pts":"—",goldFresh?changePct(gold.last_movement_pct):"—",goldFresh?Number(gold.last_movement_usd_per_oz):null,goldFresh?"Atualizado":"Atrasado",""],
 ["Múltiplos σ15 / σ60",goldFresh&&goldGood&&ok(gold.sigma15_multiples)&&ok(gold.sigma60_multiples)?num(gold.sigma15_multiples)+" / "+num(gold.sigma60_multiples):"—","—","—","—",goldFresh&&goldGood?"Contexto":"Indisponível",""],
 ["σ anterior · mesmo horário",benchReady(goldHist)&&ok(goldHist.previous_sigma15_points)?"±"+num(goldHist.previous_sigma15_points)+" pts":"—","—","—","—",benchReady(goldHist)?historicLabel(goldHist):"Sem referência",goldHist?.previous_globex_session_date?(goldHist.previous_globex_session_date+" · MGC, mesmo vencimento e faixa de 5min"):"Sessão anterior ainda não importada"],
 histRow("σ mediana histórica · horário",goldHist,goldHist?.median_15m_points,benchInfo(goldHist)),
 histRow("σ P75 histórica · horário",goldHist,goldHist?.p75_15m_points,"Percentil 75 · MGC contrato idêntico · pesquisa"),
 histRow("σ P90 histórica · horário",goldHist,goldHist?.p90_15m_points,"Percentil 90 · MGC contrato idêntico · pesquisa"),
 ["Expansão / compressão",goldGood?String(gs.volatility_regime||"INDETERMINADO").replaceAll("_"," "):"—","—","—","—",goldGood?"Contexto":"Indisponível","Regime relativo atual; não é índice histórico"],
 ["Índice expansão vs. mediana",benchRatioReady(goldHist)?num(goldHist.expansion_ratio)+"×":"—","—","—","—",benchRatioReady(goldHist)?"Pesquisa":benchReady(goldHist)?"Aguardando LIVE":"Sem referência",percentileInfo(goldHist)]
 ];
 renderTable("rdDailyGold","RADAR OURO · MGC",gRows,"Mediana e percentis Globex V3: reconstruídos dos M1 completos por contrato, referência de 5min; índice somente com sigma LIVE recente e alinhada. Sem autorização de trading.");
 put("rdDailyStamp","Consulta: "+stamp(new Date().toISOString())+" BRT"+
  (errors.length?" · Falha de fontes: "+errors.join(", "):"")+
  (!nqHist&&!goldHist&&!errors.includes("globexBench")?" · Benchmarks: API não retornou linhas":""));
 put("rdDailyToday","NQ σ "+(nqGood?"ATUAL":"PENDENTE")+" · Ouro σ "+(goldGood?"ATUAL":"PENDENTE")+" · Variações macro 15m NÃO PUBLICADAS"+(coverageOk?" · status das fontes válido":""));
}
async function load(){
 if(typeof api!=="function"){put("rdDailyStamp","API Supabase indisponível");return}
 const results=await Promise.allSettled(sources.map(x=>request(x[1],x[2])));
 const data={},errors=[];
 results.forEach((r,i)=>{const k=sources[i][0];if(r.status==="fulfilled")data[k]=r.value;else{data[k]=[];errors.push(k)}});
 show(data,errors);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load);else load();
setInterval(()=>{if(document.visibilityState!=="hidden")load()},60000);
})();