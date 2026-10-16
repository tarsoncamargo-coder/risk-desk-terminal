/* Leitura diária integrada: somente consultas públicas saneadas, sem sinal operacional. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const ok=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
const num=(v,d=2)=>ok(v)?Number(v).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d}):"—";
const sign=v=>ok(v)?(Number(v)>0?"↑ +":Number(v)<0?"↓ ":"→ ")+num(v,2):"—";
const stamp=v=>{const t=Date.parse(v||"");return Number.isFinite(t)?new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"}).format(t):"—"};
const recent=(v,m=6)=>{const t=Date.parse(v||"");return Number.isFinite(t)&&(Date.now()-t)/60000>=-2&&(Date.now()-t)/60000<=m};
const put=(id,s)=>{if($(id))$(id).textContent=s};
const mk=(tag,cl,txt)=>{const e=document.createElement(tag);e.className=cl;e.textContent=txt;return e};
const request=(table,params)=>api(table,params).then(v=>Array.isArray(v)?v:[]);
const sources=[
 ["context","riskdesk_j14c_context_site_v1","select=*&limit=1"],
 ["nqSigma","riskdesk_j14k_sigma_research_site_v1","select=*&limit=1"],
 ["nqPR","riskdesk_j14l_anchor_context_site_v1","select=*&order=last_updated_at_utc.desc&limit=5"],
 ["goldSigma","riskdesk_j15_gold_sigma_site_v1","select=*&limit=1"],
 ["goldPR","riskdesk_j15_gold_pr_site_v1","select=*&order=anchor_minute_utc.desc&limit=5"],
 ["health","riskdesk_j14a_live_health_site_v1","select=*&order=sort_index.asc&limit=25"],
 ["fed","riskdesk_j14e_zq_weighted_site_v1","select=*&order=month_first.asc&limit=2"]
];
function statusTone(value){
 const s=String(value||"").toUpperCase();
 if(!s||s==="—")return "neutral";
 if(/STALE|NOT_60|PENDING|WARM|INDETERMIN|AGUARDANDO|RECONSTRUCT|PARTIAL/.test(s))return "warning";
 if(/UNAVAILABLE|ERROR|FAIL|MISSING|SEM LEITURA|NÃO VALIDADO/.test(s))return "negative";
 if(/READY|PASS|OK|VALID|RECENT|CAPTURADO|CONGELADO/.test(s))return "positive";
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
 const wrap=mk("div","rd-daily-scroll","");
 const table=mk("table","rd-radar-table","");
 const thead=mk("thead","","");const trh=mk("tr","","");
 ["Ativo","Valor","Variação","%","Direção","Status"].forEach(v=>trh.append(mk("th","",v)));
 thead.append(trh);table.append(thead);const body=mk("tbody","","");
 for(const row of rows){
  const tr=mk("tr","","");
  const [name,value,change,pc,direction,status,age]=row;
  const dir=typeof direction==="number"?(direction>0?"↑":direction<0?"↓":"→"):"—";
  const tone=dir==="↑"?"up":dir==="↓"?"down":dir==="→"?"flat":"missing";
  [[name,"rd-radar-name"],[value,"rd-radar-number"],[change,"rd-radar-number"],[pc,"rd-radar-number"],[dir,"rd-radar-direction rd-radar-direction--"+tone],[status,"rd-radar-status rd-radar-status--"+statusTone(status)]].forEach(([value,cl])=>tr.append(mk("td",cl,String(value))));
  if(age)tr.title=age;
  body.append(tr);
 }
 table.append(body);wrap.append(table);root.append(wrap);
 if(foot)root.append(mk("div","rd-daily-muted",foot));
}
function tableNum(x,d=2){return ok(x)?num(x,d):"—"}
function changePct(x){return ok(x)?(Number(x)>0?"+":"")+num(x,3)+"%":"—"}
function statusFrom(ts,other){if(!other)return "Indisponível";if(!ts)return "Contexto";return recent(ts)?"Atualizado":"Atrasado"}
function show(data,errors){
 const c=data.context?.[0],snap=data.snap?.[0],ns=data.nqSigma?.[0],nq=(data.nqPR||[]).find(x=>x.asset==="NQ"&&x.price_reference_is_frozen);
 const gs=data.goldSigma?.[0],gold=(data.goldPR||[]).find(x=>x.reference_locked),fed=data.fed?.[0];
 const nqGood=/PASS|READY|OK/.test(String(ns?.quality_status||"").toUpperCase())&&recent(ns?.source_minute_utc)&&Number(ns?.contiguous_returns_60m)>=60&&ok(ns?.sigma_60m_points);
 const goldGood=gs?.source_state==="MGC_CLOSED_M1_SIGMA_RESEARCH_QUALITY_PASS"&&recent(gs?.source_last_minute_utc)&&ok(gs.sigma_60m_points);
 const nqFresh=nq?.fresh_data===true&&recent(nq.market_timestamp_utc);
 const goldFresh=gold?.freshness==="REFERENCE_FROZEN_AND_BAR_RECENT"&&recent(gold.market_bar_minute_utc);
 const mkrow=(name,value,delta,status,ts)=>[name,value,"—",changePct(delta),ok(delta)?Number(delta):null,status,ts?stamp(ts):""];
 const series=(k)=>snap?.[k+"_15m_pct"];
 const aligned=recent(snap?.anchor_utc,20)&&recent(snap?.assessed_at_utc,20);
 const sourceStatus=k=>{const v=snap?.[k+"_source_status"];return aligned&&ok(series(k))&&v&&!/STALE|UNAVAILABLE|MISSING|INVALID/.test(String(v).toUpperCase())?"Atualizado":v?"Atrasado":"Indisponível"};
 const macroRows=[
  mkrow("NQ","—",aligned?series("nq"):null,sourceStatus("nq"),snap?.anchor_utc),
  mkrow("ZT · futuro 2Y","—",aligned?series("zt"):null,sourceStatus("zt"),snap?.anchor_utc),
  mkrow("ZN · futuro 10Y","—",aligned?series("zn"):null,sourceStatus("zn"),snap?.anchor_utc),
  mkrow("DXY · MT5","—",aligned?series("dxy_mt5"):null,sourceStatus("dxy"),snap?.anchor_utc),
  ["ZQ sintético",ok(fed?.zq_flat_weighted)?num(fed.zq_flat_weighted,4):"—","—","—","—",fed?"Contexto":"Indisponível","Cenário hipotético, não cotação"],
  ["ZQ negociado",fed?.official_settlement_verified&&ok(fed.cme_daily_settlement)?num(fed.cme_daily_settlement,4):"—","—","—","—",fed?.official_settlement_verified?"Diário":"Indisponível","Settlement CME verificado apenas quando disponível"],
  ["VXN","—","—","—","—","Indisponível","Sem cotação e baseline sincronizados neste radar"],
  ["VIX","—","—","—","—","Indisponível","Sem cotação e baseline sincronizados neste radar"]
 ];
 renderTable("rdDailyMacro","RADAR MACRO · 15 MIN",macroRows,"Variações de NQ, ZT, ZN e DXY representam % em 15 minutos; valores absolutos e mudanças em pontos não estão liberados nesta fonte. ZT/ZN são preços de futuros, não yields. ");
 const mkSigma=(x,k,good)=>["σ "+k+"m",good?("±"+num(x?.["sigma_"+k+"m_points"])+" pts"):"—","—","—","—",good?"Atualizado":"Indisponível","Sigma realizada, não IV"];
 const nqRows=[...([5,15,30,60].map(k=>mkSigma(ns,k,nqGood))),
 ["PR congelado",nq?.price_reference_is_frozen?"Capturado":"—","—","—","—",nq?"Contexto":"Indisponível",nq?.status||""],
 ["Distância do PR",nqFresh?((Number(nq.movement_since_reference_points)>0?"+":"")+num(nq.movement_since_reference_points)+" pts"):"—",nqFresh?num(nq.movement_since_reference_points)+" pts":"—",nqFresh?changePct(nq.movement_since_reference_pct):"—",nqFresh?Number(nq.movement_since_reference_points):null,nqFresh?"Atualizado":"Atrasado",""],
 ["Múltiplos σ15 / σ60",nqFresh&&nqGood&&ok(nq.travelled_current_sigma15)&&ok(nq.travelled_current_sigma60)?num(nq.travelled_current_sigma15)+" / "+num(nq.travelled_current_sigma60):"—","—","—","—",nqFresh&&nqGood?"Contexto":"Indisponível",""],
 ["σ anterior · mesmo horário","—","—","—","—","Indisponível","Histórico da sessão anterior ainda não validado"],
 ["σ mediana histórica · horário","—","—","—","—","Indisponível","Mínimo de 20 sessões comparáveis"],
 ["Expansão / compressão",nqGood?String(ns.volatility_regime||"INDETERMINADO").replaceAll("_"," "):"—","—","—","—",nqGood?"Contexto":"Indisponível","Regime relativo atual; não é índice histórico"],
 ["Índice expansão vs. mediana","—","—","—","—","Indisponível","Aguardando mediana e percentis P75 / P90"]
 ];
 renderTable("rdDailyNasdaq","RADAR NASDAQ · NQ",nqRows,"Volatilidade: "+(nqGood?String(ns.volatility_regime||"Indeterminada").replaceAll("_"," "):"sem amostra atual")+" · Macro: "+(c?.research_data_status||"sem validação"));
 const gRows=[...([5,15,30,60].map(k=>mkSigma(gs,k,goldGood))),
 ["PR congelado",gold?"Capturado":"—","—","—","—",gold?"Contexto":"Indisponível",gold?.session_code||""],
 ["Distância do PR",goldFresh?((Number(gold.last_movement_usd_per_oz)>0?"+":"")+num(gold.last_movement_usd_per_oz)+" pts"):"—",goldFresh?num(gold.last_movement_usd_per_oz)+" pts":"—",goldFresh?changePct(gold.last_movement_pct):"—",goldFresh?Number(gold.last_movement_usd_per_oz):null,goldFresh?"Atualizado":"Atrasado",""],
 ["Múltiplos σ15 / σ60",goldFresh&&goldGood&&ok(gold.sigma15_multiples)&&ok(gold.sigma60_multiples)?num(gold.sigma15_multiples)+" / "+num(gold.sigma60_multiples):"—","—","—","—",goldFresh&&goldGood?"Contexto":"Indisponível",""],
 ["σ anterior · mesmo horário","—","—","—","—","Indisponível","Histórico da sessão anterior ainda não validado"],
 ["σ mediana histórica · horário","—","—","—","—","Indisponível","Mínimo de 20 sessões comparáveis"],
 ["Expansão / compressão",goldGood?String(gs.volatility_regime||"INDETERMINADO").replaceAll("_"," "):"—","—","—","—",goldGood?"Contexto":"Indisponível","Regime relativo atual; não é índice histórico"],
 ["Índice expansão vs. mediana","—","—","—","—","Indisponível","Aguardando mediana e percentis P75 / P90"]
 ];
 renderTable("rdDailyGold","RADAR OURO · MGC",gRows,"Confluência: DXY + ZT/ZN + volatilidade. Viés direcional não autorizado sem dados convergentes.");
 put("rdDailyStamp","Consulta: "+stamp(new Date().toISOString())+" BRT"+(errors.length?" · Falha de fontes: "+errors.join(", "):""));
 put("rdDailyToday","NQ σ "+(nqGood?"ATUAL":"PENDENTE")+" · Ouro σ "+(goldGood?"ATUAL":"PENDENTE")+" · Radar macro "+(aligned?"15m":"SEM ATUALIZAÇÃO"));
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