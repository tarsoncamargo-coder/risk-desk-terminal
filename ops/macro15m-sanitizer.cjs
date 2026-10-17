'use strict';
/**
 * J14C - pure server-side sanitizer, not an HTTP endpoint.
 * Authentication, entitlement and CME/provider license checks must occur
 * BEFORE this return value can be sent to any client.
 * No production DB access, credentials, or network requests.
 */
const SOURCES=Object.freeze([
 {asset:'NQ',value:'nq_15m_pct',status:'nq_source_status',source:'NINJATRADER'},
 {asset:'ZT',value:'zt_15m_pct',status:'zt_source_status',source:'NINJATRADER'},
 {asset:'ZN',value:'zn_15m_pct',status:'zn_source_status',source:'NINJATRADER'},
 {asset:'DXY_MT5',value:'dxy_mt5_15m_pct',status:'dxy_source_status',source:'MT5_ACTIVTRADES_SHADOW'}
]);
const AGE_MS=6*60_000,FUTURE_MS=2*60_000,MAX_CAPTURE_MS=2*60_000;
function dateMillis(input){
 if(typeof input!=='string'||!/(?:Z|[+-]\d\d:\d\d)$/.test(input))return NaN;
 const n=Date.parse(input);return Number.isFinite(n)?n:NaN;
}
function clockGood(s,now=Date.now()){
 if(!s||typeof s!=='object'||!Number.isFinite(now)||
   s.provenance!=='J14C_CONTINUOUS_SHADOW_NOT_TRADE'||
   s.authorized_for_trading_or_models!==false)return false;
 const a=dateMillis(s.anchor_utc),b=dateMillis(s.assessed_at_utc),c=dateMillis(s.captured_at_utc);
 if(![a,b,c].every(Number.isFinite)||a%(5*60_000)!==0)return false;
 if([a,b,c].some(x=>x<now-AGE_MS||x>now+FUTURE_MS))return false;
 if([b,c].some(x=>x<a-60_000||x>a+MAX_CAPTURE_MS))return false;
 return Math.abs(b-c)<=MAX_CAPTURE_MS;
}
function validPercent(v){
 if(v===null||v===undefined||v===''||typeof v==='boolean')return null;
 if(typeof v!=='number'&&!(typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v.trim())))return null;
 const n=Number(v);
 if(!Number.isFinite(n)||Math.abs(n)>10)return null;
 return Math.round(n*100000)/100000;
}
function sanitizeMacro15mSnapshot(snapshot,now=Date.now()){
 const clock=clockGood(snapshot,now);
 return SOURCES.map(s=>{
  const pct=clock&&snapshot[s.status]==='FRESH_15M_COMPARABLE'?validPercent(snapshot[s.value]):null;
  return Object.freeze({
   asset:s.asset,source_name:s.source,
   anchor_utc:clock?new Date(dateMillis(snapshot.anchor_utc)).toISOString():null,
   return_15m_pct:pct,
   data_status:pct===null?'BLOCKED_SOURCE_QUALITY_OR_FRESHNESS':'RESEARCH_15M_VALID',
   data_regime:'J14C_DIRECTIONAL_CONTEXT_NOT_ENTRY_SIGNAL',
   authorized_for_trade_ml:false
  });
 });
}
module.exports={sanitizeMacro15mSnapshot,clockGood,validPercent};