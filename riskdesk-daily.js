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
function show(data,errors){
 const c=data.context?.[0],ns=data.nqSigma?.[0],nq=(data.nqPR||[]).find(x=>x.asset==="NQ"&&x.price_reference_is_frozen),gs=data.goldSigma?.[0],gold=(data.goldPR||[]).find(x=>x.reference_locked);
 const health=data.health||[], fed=data.fed?.[0];
 const nqGood=/PASS|READY|OK/.test(String(ns?.quality_status||"").toUpperCase())&&recent(ns.source_minute_utc)&&ok(ns.sigma_60m_points)&&Number(ns.contiguous_returns_60m)>=60;
 const goldGood=gs?.source_state==="MGC_CLOSED_M1_SIGMA_RESEARCH_QUALITY_PASS"&&recent(gs.source_last_minute_utc)&&ok(gs.sigma_60m_points);
 const nqPrLive=!!nq&&nq.fresh_data===true&&recent(nq.market_timestamp_utc);
 const goldPrLive=!!gold&&gold.freshness==="REFERENCE_FROZEN_AND_BAR_RECENT"&&recent(gold.market_bar_minute_utc);
 const sigma=(x,k,good)=>good?"±"+num(x?.["sigma_"+k+"m_points"])+" pts":"—";
 const nqItems=[
 ["σ 5 / 15 min",sigma(ns,5,nqGood)+" / "+sigma(ns,15,nqGood),"M1 realizado · "+stamp(ns?.source_minute_utc)],
 ["σ 30 / 60 min",sigma(ns,30,nqGood)+" / "+sigma(ns,60,nqGood),"Regime: "+(nqGood?ns?.volatility_regime:"aguardando qualidade")],
 ["PR congelado",nq?"Capturado":"Pendente",nq?.status||"Sem referência validada"],
 ["Distância desde PR",nqPrLive?sign(nq.movement_since_reference_points)+" pts":"—",nqPrLive?num(nq.movement_since_reference_pct,4)+"%":"Sem leitura atual"],
 ["Distância / σ15 e σ60",nqPrLive&&nqGood?num(nq.travelled_current_sigma15)+" / "+num(nq.travelled_current_sigma60):"—","Somente com fonte e sigma válidas"],
 ["Confluência macro",c?.research_data_status||"Indisponível",c?.continuous_bias?("Contexto: "+c.continuous_bias):"Sem viés consolidado"]
 ];
 card("rdDailyNasdaq","NASDAQ · NQ","Preço, volatilidade e contexto macro reunidos. Referência não equivale a nível de opções.",nqItems);
 const goldItems=[
 ["σ 5 / 15 min",sigma(gs,5,goldGood)+" / "+sigma(gs,15,goldGood),"MGC M1 · "+stamp(gs?.source_last_minute_utc)],
 ["σ 30 / 60 min",sigma(gs,30,goldGood)+" / "+sigma(gs,60,goldGood),"Regime: "+(goldGood?gs?.volatility_regime:"aquecendo/indisponível")],
 ["PR vigente",gold?"Congelado":"Pendente",gold?.session_code?gold.session_code.replaceAll("_"," ")+" · "+gold.session_date:"Aguardando sessão válida"],
 ["Distância desde PR",goldPrLive?sign(gold.last_movement_usd_per_oz)+" pts":"—",goldPrLive?num(gold.last_movement_pct,4)+"%":"Sem leitura atual"],
 ["Distância / σ15 e σ60",goldGood&&goldPrLive?num(gold.sigma15_multiples)+" / "+num(gold.sigma60_multiples):"—","Não é sigma implícita nem probabilidade"],
 ["Confluência macro","DXY + juros + volatilidade","Leitura conjunta abaixo, sem sinal automático"]
 ];
 card("rdDailyGold","OURO · MGC","Um único PR vigente; distância e sigmas próprias do Ouro, sem misturar com Nasdaq.",goldItems);
 const mapped=[["DXY","DXY"],["ZT","ZT · Treasury 2Y futuro"],["ZN","ZN · Treasury 10Y futuro"],["VIX","VIX · volatilidade S&P"],["VXN","VXN · volatilidade Nasdaq"]];
 const macro=mapped.map(([k,label])=>{
 const h=health.find(x=>String(x.item_key||"").toUpperCase().includes(k)||String(x.label_pt||"").toUpperCase().includes(k));
 const source=c?.[k.toLowerCase()+"_source_status"];
 return [label,h?.diagnostic_status||source||"Não validado",(h?.last_market_ts_utc?"Fonte: "+h.source_name+" · "+stamp(h.last_market_ts_utc):"Cotação e variação numérica não disponíveis nesta fonte saneada")];
 });
 macro.push(["ZQ / Fed",fed?.quality_status||"Não disponível",fed?"Cenários teóricos; settlement verificado: "+(fed.official_settlement_verified?"sim":"não"):"Sem dados atuais"]);
 card("rdDailyMacro","JUROS · DÓLAR · VOLATILIDADE","DXY e Treasury ajudam a contextualizar ambos os ativos; ZT/ZN são futuros, não yields 2Y/10Y. Sem extrapolar direção automaticamente.",macro);
 put("rdDailyStamp","Consultado: "+stamp(new Date().toISOString())+" BRT · Dados individuais podem ter idades diferentes"+(errors.length?" · Falha: "+errors.join(", "):""));
 const brief="NQ: "+(nqGood?"sigma válida":"sigma pendente")+" · PR "+(nqPrLive?"atual":"não atual")+"  |  Ouro: "+(goldGood?"sigma válida":"sigma pendente")+" · PR "+(goldPrLive?"atual":"não atual");
 put("rdDailyToday",brief);
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