/* J15 Gold research dashboard.
   Reads sanitized RLS-only sigma and PR-distance from Supabase.
   Does NOT republish private broker MGC quotes and NEVER manufactures a reference price.
   No Laranjinha/GEN1/GEN2/Market State or order integration. */
(function(){
"use strict";
const TZ="America/Sao_Paulo";
const el=(id)=>document.getElementById(id);
const n=(v,d=2)=>Number(v).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
const valid=(v)=>v!==null&&v!==undefined&&Number.isFinite(Number(v));
const node=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
const clock=(v)=>{
 const ts=Date.parse(v??"");
 return Number.isFinite(ts)?new Intl.DateTimeFormat("pt-BR",{timeZone:TZ,dateStyle:"short",timeStyle:"short"}).format(new Date(ts)):"—";
};
const age=(v)=>{const t=Date.parse(v??"");return Number.isFinite(t)?(Date.now()-t)/60000:null};
const fresh=(v)=>age(v)!==null&&age(v)>=-2&&age(v)<=5;
const pass=(s)=>s?.source_state==="MGC_CLOSED_M1_SIGMA_RESEARCH_QUALITY_PASS"&&fresh(s.source_last_minute_utc);
const set=(id,value)=>{if(el(id))el(id).textContent=value;};
const load=async()=>{
 if(typeof api!=="function")throw new Error("Supabase API missing");
 const [s,r]=await Promise.all([
  api("riskdesk_j15_gold_sigma_site_v1","select=calculated_at_utc,source_last_minute_utc,contract_month_label,sigma_5m_points,sigma_15m_points,sigma_30m_points,sigma_60m_points,sigma_15m_pct,sigma_60m_pct,n15,n60,volatility_regime,source_state&id=eq.1&limit=1"),
  api("riskdesk_j15_gold_pr_site_v1","select=contract,session_code,session_date,updated_at_utc,anchor_minute_utc,market_bar_minute_utc,reference_locked,last_movement_usd_per_oz,last_movement_pct,sigma15_multiples,sigma60_multiples,freshness&order=session_date.desc&limit=10")
 ]);
 return {sigma:Array.isArray(s)?s[0]||null:null,refs:Array.isArray(r)?r:[]};
};
function drawOne(s,refs){
 const good=pass(s);
 const warmup=s?.source_state==="MGC_NOT_60_CONSECUTIVE_M1_RETURNS"&&fresh(s.source_last_minute_utc);
 set("goldStatus",good?"MGC · M1 VALIDADO PARA PESQUISA":warmup?"MGC · AQUECENDO SIGMA":"MGC · SEM LEITURA M1 ATUAL");
 set("goldDescription",good?"Fonte NinjaTrader · "+s.contract_month_label+
  " · último fechamento M1 "+clock(s.source_last_minute_utc)+" (BRT)":
  warmup?"NinjaTrader conectado · "+Math.max(0,Number(s.n60)||0)+"/60 retornos M1 consecutivos · faltam "+
  Math.max(0,60-(Number(s.n60)||0))+" retornos. Último M1: "+clock(s.source_last_minute_utc)+" (Brasília)."+
  " Não mostrar σ antes de completar 60 retornos.":
  "Aguardando dados MGC M1 frescos e completos. Estado: "+(s?.source_state||"NO_GOLD_BARS_YET"));
 for(const m of [5,15,30,60]){
  const v=s?.["sigma_"+m+"m_points"];
  set("goldSigma"+m,good&&valid(v)?"±"+n(v,2)+" pts":"—");
 }
 set("goldSigma15Pct",good&&valid(s.sigma_15m_pct)?n(s.sigma_15m_pct,4)+"% / 15m":"Sem dados validados");
 set("goldSigma60Pct",good&&valid(s.sigma_60m_pct)?n(s.sigma_60m_pct,4)+"% / 60m":"Sem dados validados");
 set("goldRegime",good?String(s.volatility_regime||"INDETERMINADO").replaceAll("_"," "):"INDETERMINADO");
 const root=el("goldReferenceDetails");
 if(root){
  root.replaceChildren();
  const active=refs.find(x=>x.session_code==="OP_DAY_19_BRT")||refs[0];
  if(!active){root.append(node("p","Sem PR congelado: ele será capturado automaticamente a partir da abertura da primeira vela M1 da sessão, quando a ponte local estiver em funcionamento.","rd-orch__note"));}
  else {
   const isCurrent=active.freshness==="REFERENCE_FROZEN_AND_BAR_RECENT"&&fresh(active.market_bar_minute_utc);
   const lines=[
    ["Sessão",active.session_code==="OP_DAY_19_BRT"?"Início do dia · 19h Brasília":"Abertura NY · 09h30 ET"],
    ["PR fixado",clock(active.anchor_minute_utc)+" (fonte MGC; preço absoluto protegido)"],
    ["Variação desde PR",valid(active.last_movement_usd_per_oz)?
      (Number(active.last_movement_usd_per_oz)>0?"+":"")+n(active.last_movement_usd_per_oz,2)+" pts · "+
      (Number(active.last_movement_pct)>0?"+":"")+n(active.last_movement_pct,4)+"%":"—"],
    ["Distância / σ15",isCurrent&&valid(active.sigma15_multiples)?n(active.sigma15_multiples,2)+" σ":"Indisponível ou amostra antiga"],
    ["Distância / σ60",isCurrent&&valid(active.sigma60_multiples)?n(active.sigma60_multiples,2)+" σ":"Indisponível ou amostra antiga"],
    ["Último fechamento",clock(active.market_bar_minute_utc)+" (BRT) · "+(isCurrent?"Recente":"DESATUALIZADO")]
   ];
   for(const [name,value] of lines){const row=node("div","","rd-orch__line");
    row.append(node("span",name,"rd-orch__line-title"),node("span",value,"rd-orch__line-content"));
    root.append(row);
   }
  }
 }
 set("goldLastUpdated",clock(s?.source_last_minute_utc));
 const mini=el("goldSummaryToday");
 if(mini){
  mini.replaceChildren();
  const title=node("div","OURO / MGC · SIGMA","rd-orch__title");
  const info=node("div",good?
   "σ15 ±"+n(s.sigma_15m_points,2)+" pts · σ60 ±"+n(s.sigma_60m_points,2)+" pts · "+
    String(s.volatility_regime).replaceAll("_"," "):
   warmup?"MGC conectado · "+(Math.max(0,Number(s.n60)||0))+"/60 retornos consecutivos para liberar a sigma.": 
   "Sem MGC M1 recente; aguardando ponte NinjaTrader.","rd-orch__detail");
  mini.append(title,info);
 }
}
async function refresh(){
 if(!el("goldStatus")&&!el("goldSummaryToday"))return;
 try{const {sigma,refs}=await load();drawOne(sigma,refs);}
 catch(_){set("goldStatus","DADOS DE OURO INDISPONÍVEIS");
  set("goldDescription","Sem resposta validada do Supabase; não exibir preços ou sigmas antigos como LIVE.");}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",refresh);
else refresh();
setInterval(()=>{if(document.visibilityState!=="hidden")refresh();},120000);
})();