'use strict';
const assert=require('node:assert/strict');
const {sanitizeMacro15mSnapshot:sanitize,clockGood,validPercent}=require('../ops/macro15m-sanitizer.cjs');
// All values below are SYNTHETIC test fixtures, not actual market observations.
const time=Date.parse('2026-10-16T21:00:30Z');
const fixture=()=>({
 anchor_utc:'2026-10-16T21:00:00Z',
 assessed_at_utc:'2026-10-16T21:00:00.311Z',
 captured_at_utc:'2026-10-16T21:00:00.311Z',
 provenance:'J14C_CONTINUOUS_SHADOW_NOT_TRADE',
 authorized_for_trading_or_models:false,
 nq_source_status:'FRESH_15M_COMPARABLE',zt_source_status:'FRESH_15M_COMPARABLE',
 zn_source_status:'FRESH_15M_COMPARABLE',dxy_source_status:'MT5_FORMULA_OR_TICK_QUALITY_FAILED',
 nq_15m_pct:'-0.12500',zt_15m_pct:'0.01000',zn_15m_pct:'0.00000',dxy_mt5_15m_pct:'0.00000',
 secret:'NEVER_COPY',current_price:98765
});
let count=0;
function test(name,fn){fn();console.log('PASS',name);count++}
test('valid assets and quality-gated DXY / authentic zero',()=>{
 const v=sanitize(fixture(),time);
 assert.deepEqual(v.map(x=>x.return_15m_pct),[-.125,.01,0,null]);
 assert.deepEqual(v.map(x=>x.asset),['NQ','ZT','ZN','DXY_MT5']);
 assert.ok(v.every(x=>x.authorized_for_trade_ml===false&&!('secret' in x)&&!('current_price' in x)));
});
test('stale source',()=>assert.ok(sanitize(fixture(),time+8*60_000).every(x=>x.return_15m_pct===null)));
test('future-dated source',()=>assert.ok(sanitize(fixture(),time-4*60_000).every(x=>x.return_15m_pct===null)));
test('wrong provenance / authorized-to-trade flag',()=>{
 for(const patch of [{provenance:'UNKNOWN'},{authorized_for_trading_or_models:true},{authorized_for_trading_or_models:null}])
  assert.ok(sanitize({...fixture(),...patch},time).every(x=>x.return_15m_pct===null));
});
test('clock misalignment or ingestion/replay gap',()=>{
 for(const patch of [{anchor_utc:'2026-10-16T21:01:00Z'},{assessed_at_utc:'bad'},{captured_at_utc:'2026-10-16T20:48:00Z'}])
  assert.ok(sanitize({...fixture(),...patch},time).every(x=>x.return_15m_pct===null));
});
test('invalid percent values',()=>{
 for(const v of [null,undefined,'',false,Infinity,'11.0','1e6','NaN'])
  assert.equal(sanitize({...fixture(),nq_15m_pct:v},time)[0].return_15m_pct,null);
 assert.equal(validPercent(0),0);
});
test('per-asset quality isolation',()=>{
 const v=sanitize({...fixture(),zt_source_status:'MARKET_BAR_STALE'},time);
 assert.equal(v[0].return_15m_pct,-.125);assert.equal(v[1].return_15m_pct,null);assert.equal(v[2].return_15m_pct,0);
});
test('missing snapshot fails closed',()=>{
 const v=sanitize(null,time);
 assert.equal(v.length,4);assert.ok(v.every(x=>x.return_15m_pct===null&&x.anchor_utc===null));
});
test('UTC offsets do not cause a DST error',()=>{
 assert.equal(clockGood({...fixture(),anchor_utc:'2026-10-16T18:00:00-03:00'},time),true);
});
console.log('PASS',count,'synthetic scenarios');