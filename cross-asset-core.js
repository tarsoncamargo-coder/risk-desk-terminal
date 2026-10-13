/* Risk Desk V10 — leitura descritiva; nenhum sinal, score, probabilidade ou ordem. */
(function(root) {
"use strict";
var lim={NQ:3,ZN:3,ZT:5,ZQ:10,DXY:5,VIX:5,VXN:5};
var key={NQ:"NQ",US2Y:"ZT",US10Y:"ZN",DXY:"DXY",ZQ:"ZQ"};
function dt(s){var t=s?new Date(s).getTime():NaN;return Number.isFinite(t)?t:null;}
function age(s,now){var t=dt(s);return t===null?null:(now-t)/60000;}
function quality(asset,q,now) {
  now=Number.isFinite(now)?now:Date.now();
  if(!q||!q.ts_utc)return {state:"UNAVAILABLE",canConfirm:false,age:null,source:q&&q.source||null};
  var a=age(q.ts_utc,now),src=q.source||null,qual=q.quality_status||"UNKNOWN";
  if(qual==="OFF_SESSION_SOURCE")return {state:"OFF_SESSION",canConfirm:false,age:a,source:src};
  if(a===null||a < -2||qual!=="OK")return {state:"UNAVAILABLE",canConfirm:false,age:a,source:src};
  var max=lim[asset]||3;
  if(a<=max)return {state:"FRESH",canConfirm:true,age:a,source:src};
  if(asset==="ZQ"&&a<=60)return {state:"SPARSE",canConfirm:false,age:a,source:src};
  return {state:"DELAYED",canConfirm:false,age:a,source:src};
}
function eventState(e,s,m,now,matrix) {
  now=Number.isFinite(now)?now:Date.now();
  if(!e||dt(e.scheduled_ts_utc)===null)return {mode:"NO_EVENT",tab:"live",label:"SEM EVENTO",why:"Sem evento verificável"};
  var t0=dt(e.scheduled_ts_utc);
  if(now<t0-1440*60000)return {mode:"BEFORE_PRE1440",tab:"live",label:"MERCADO LIVE",why:"Janela PRE1440 ainda não começou"};
  if(now<t0)return {mode:"PRE_PRICING",tab:"live",label:"PRE-PRICING",why:"Pré-pricing não prevê o resultado do evento"};
  if(e.actual==null||!e.available_at||!e.actual_source||String(e.source_status).toUpperCase()==="SCHEDULED")
    return {mode:"WAIT_RELEASE",tab:"live",label:"AGUARDANDO RELEASE",why:"Horário atingido, mas Actual oficial não comprovado"};
  if(e.consensus==null||e.official_surprise==null||!e.consensus_source)
    return {mode:"PARTIAL_RELEASE",tab:"live",label:"RELEASE PARCIAL",why:"Falta consenso ou surpresa com fonte"};
  if(!s||s.event_id!==e.event_id||s.mapping_complete!==true||s.prospective_fresh!==true||
    dt(s.updated_at)===null||dt(s.updated_at)<t0||!["HAWKISH","DOVISH","MIXED","NEUTRAL"].includes(String(s.stance_bundle||"").toUpperCase()))
    return {mode:"WAIT_SEMANTIC",tab:"live",label:"AGUARDANDO SEMÂNTICA",why:"J11 ainda sem interpretação prospectiva validada"};
  var releaseAt=dt(e.available_at);
  var verified=(m||[]).some(function(x){return x.event_id===e.event_id&&/^POST(1|5|15|30|60)$/.test(String(x.window||""))&&
    x.product_status==="LEITURA_DISPONIVEL"&&dt(x.as_of_utc)!==null&&dt(x.as_of_utc)>=Math.max(t0,releaseAt||t0);});
  var matrixReady=(matrix||[]).some(function(r){return r.event_id===e.event_id&&
    /^POST(1|5|15|30|60)$/.test(String(r.market_window||""))&&
    r.product_status==="LEITURA_DISPONIVEL"&&r.raw_value!==null&&
    Number.isFinite(Number(r.raw_value))&&
    ["ALIGNED","CONTRARY","NEUTRAL"].includes(String(r.alignment||""));});
  if(!verified||!matrixReady)return {mode:"WAIT_POST_MARKET",tab:"live",label:"PÓS-EVENTO · MERCADO PENDENTE",
    why:"Semântica publicada, mas falta janela POST e alinhamento cross-asset observados na própria matriz"};
  return {mode:"POST_CONFIRMATION",tab:"event",label:"CONFIRMAÇÃO PÓS-EVENTO",
    why:"Release, semântica, janela POST e matriz de reação observada presentes"};
}
function classifyLayer(r,quotes,now) {
  var asset=key[r.layer_key]||null;
  var byAsset=function(k){return (quotes||[]).find(function(q){return q.asset===k;})||null;};
  var vol=r.layer_key==="VOL";
  var reading=String(r.observed_direction||"");
  if(vol&&/^VXN_(UP|DOWN)$/.test(reading))asset="VXN";
  else if(vol&&/^VIX_(UP|DOWN)$/.test(reading))asset="VIX";
  else if(vol)asset=null;
  var q=asset?quality(asset,byAsset(asset),now):{state:"UNAVAILABLE",canConfirm:false,age:null,source:null};
  var direction=reading.replace(/^VIX_/,"").replace(/^VXN_/,"");
  var raw=r.raw_value;
  var isValid=Number.isFinite(Number(raw))&&raw!==null&&
    ["UP","DOWN","NEUTRAL"].includes(direction)&&
    r.market_window==="LIVE"&&r.product_status==="LEITURA_DISPONIVEL"&&q.canConfirm;
  return {asset:asset,quality:q,state:isValid?"OBSERVED":"EXCLUDED",
    raw:isValid?Number(raw):null,direction:isValid?direction:null,
    note:isValid?"Janela LIVE; variação observada":"Sem marcador: fonte/janela não elegível"};
}
function preSummary(list) {
  var votes=[];
  (list||[]).forEach(function(v){
    if(v.state!=="OBSERVED"||v.direction==="NEUTRAL")return;
    var hawkish={
      NQ:"DOWN",US2Y:"DOWN",US10Y:"DOWN",DXY:"UP",ZQ:"DOWN",VOL:"UP"
    }[v.layer_key];
    if(!hawkish)return;
    votes.push(v.direction===hawkish?"H":"D");
  });
  var h=votes.filter(function(x){return x==="H"}).length;
  var d=votes.length-h;
  var label=votes.length<3?"EVIDÊNCIA INSUFICIENTE":
    h>=3&&d===0?"CONFIGURAÇÃO COMPATÍVEL COM JUROS MAIS ALTOS / RISK-OFF":
    d>=3&&h===0?"CONFIGURAÇÃO COMPATÍVEL COM JUROS MAIS BAIXOS / RISK-ON":"LEITURAS DIVERGENTES";
  return {label:label,restrictive:h,accommodative:d,usable:votes.length,notPrediction:true};
}
root.RiskDeskCrossAsset={quality:quality,eventState:eventState,classifyLayer:classifyLayer,preSummary:preSummary};
})(typeof window!=="undefined"?window:globalThis);
