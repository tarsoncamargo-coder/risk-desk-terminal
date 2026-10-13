"use strict";
/* No deps; no production credentials or external calls. Run: node tests/confluence-v2.test.cjs */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const src=(file)=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const now=Date.parse("2026-10-13T05:30:00Z"), time=(x)=>new Date(x).toISOString();
const root={};
vm.runInNewContext(src("cross-asset-core.js"),{window:root,globalThis:root});
const E=root.RiskDeskCrossAsset;
let total=0;function check(name,fn){fn();total++;console.log("OK",name);}
const q=(asset,age,quality="OK")=>({asset,ts_utc:time(now-age*60000),quality_status:quality,source:"TEST_ONLY"});
check("FRESH NQ <=3",()=>assert.equal(E.quality("NQ",q("NQ",1),now).state,"FRESH"));
check("DXY 11 min is DELAYED",()=>assert.equal(E.quality("DXY",q("DXY",11),now).state,"DELAYED"));
check("ZQ no recent trade is SPARSE not confirmation",()=>{const s=E.quality("ZQ",q("ZQ",18),now);assert.equal(s.state,"SPARSE");assert.equal(s.canConfirm,false);});
check("ZQ >60 min is DELAYED",()=>assert.equal(E.quality("ZQ",q("ZQ",70),now).state,"DELAYED"));
check("VIX off session",()=>assert.equal(E.quality("VIX",q("VIX",120,"OFF_SESSION_SOURCE"),now).state,"OFF_SESSION"));
check("Future timestamp rejected",()=>assert.equal(E.quality("NQ",q("NQ",-20),now).state,"UNAVAILABLE"));
check("No stale data is fresh",()=>assert.equal(E.quality("ZT",q("ZT",15),now).canConfirm,false));
const t0=now+40*60000,evt={event_id:"EV",scheduled_ts_utc:time(t0),source_status:"SCHEDULED",actual:null};
const phase=(e,s,m,n)=>E.eventState(e,s,m,n);
check("Outside PRE1440",()=>assert.equal(phase(evt,null,[],t0-1441*60000).mode,"BEFORE_PRE1440"));
check("PRE-pricing before publication",()=>assert.equal(phase(evt,null,[],t0-30*60000).mode,"PRE_PRICING"));
check("At release clock without actual",()=>assert.equal(phase(evt,null,[],t0+60000).mode,"WAIT_RELEASE"));
const official={...evt,source_status:"RELEASED",actual:0.3,actual_source:"BLS",available_at:time(t0+30000),consensus:null,official_surprise:null};
check("No consensus prevents confirmed release",()=>assert.equal(phase(official,null,[],t0+6*60000).mode,"PARTIAL_RELEASE"));
const full={...official,consensus:0.2,consensus_source:"EXTERNAL_FORECAST",official_surprise:0.1};
check("Release without semantic waits",()=>assert.equal(phase(full,null,[],t0+6*60000).mode,"WAIT_SEMANTIC"));
const sem={event_id:"EV",stance_bundle:"HAWKISH",mapping_complete:true,prospective_fresh:true,updated_at:time(t0+2*60000)};
check("Post semantic but no post price window remains pending",()=>assert.equal(phase(full,sem,[],t0+7*60000).mode,"WAIT_POST_MARKET"));
const preWindow={event_id:"EV",window:"LIVE",product_status:"LEITURA_DISPONIVEL",as_of_utc:time(t0+6*60000)};
check("LIVE snapshot not treated as observed POST",()=>assert.equal(phase(full,sem,[preWindow],t0+7*60000).mode,"WAIT_POST_MARKET"));
const postWindow={event_id:"EV",window:"POST5",product_status:"LEITURA_DISPONIVEL",as_of_utc:time(t0+6*60000)};
check("POST window alone is insufficient without matching cross-asset matrix",()=>assert.equal(phase(full,sem,[postWindow],t0+7*60000).mode,"WAIT_POST_MARKET"));
const postMatrix=[{event_id:"EV",market_window:"POST5",product_status:"LEITURA_DISPONIVEL",raw_value:-0.4,alignment:"ALIGNED"}];
check("Actual post-event matrix plus POST window enables confirmation",()=>{const s=E.eventState(full,sem,[postWindow],t0+7*60000,postMatrix);assert.equal(s.mode,"POST_CONFIRMATION");assert.equal(s.tab,"event");});
check("Old LIVE matrix never counts as post-reaction",()=>assert.equal(E.eventState(full,sem,[postWindow],t0+7*60000,postMatrix.map(r=>({...r,market_window:"LIVE"}))).mode,"WAIT_POST_MARKET"));
check("Stale semantic timestamp rejected",()=>assert.equal(phase(full,{...sem,updated_at:time(t0-10000)},[postWindow],t0+7*60000).mode,"WAIT_SEMANTIC"));
const rows=[
 {layer_key:"NQ",observed_direction:"DOWN",raw_value:-0.3,market_window:"LIVE",product_status:"LEITURA_DISPONIVEL"},
 {layer_key:"US2Y",observed_direction:"DOWN",raw_value:-0.008,market_window:"LIVE",product_status:"LEITURA_DISPONIVEL"},
 {layer_key:"US10Y",observed_direction:"DOWN",raw_value:-0.02,market_window:"LIVE",product_status:"LEITURA_DISPONIVEL"},
 {layer_key:"DXY",observed_direction:"UP",raw_value:0.12,market_window:"LIVE",product_status:"LEITURA_DISPONIVEL"},
 {layer_key:"ZQ",observed_direction:"DOWN",raw_value:-0.01,market_window:"LIVE",product_status:"LEITURA_DISPONIVEL"},
 {layer_key:"VOL",observed_direction:"UNAVAILABLE",raw_value:null,market_window:"LIVE",product_status:"LEITURA_DISPONIVEL"}
];
const quotes=[q("NQ",1),q("ZT",1),q("ZN",1),q("DXY",11),q("ZQ",18)];
const assessed=rows.map(r=>({layer_key:r.layer_key,...E.classifyLayer(r,quotes,now)}));
check("DXY and SPARSE ZQ suppressed",()=>{assert.equal(assessed[3].state,"EXCLUDED");assert.equal(assessed[4].state,"EXCLUDED");});
check("Only fresh directional assets count toward contextual pattern",()=>{const x=E.preSummary(assessed);assert.equal(x.usable,3);assert.equal(x.restrictive,3);assert.equal(x.notPrediction,true);});
check("No baseline != observed direction",()=>assert.equal(E.classifyLayer({...rows[0],market_window:"PRE1440"},quotes,now).state,"EXCLUDED"));
check("No zero marker with missing price",()=>assert.equal(E.classifyLayer({...rows[0],raw_value:null},quotes,now).state,"EXCLUDED"));
check("VOL specific VIX source offsession suppressed",()=>assert.equal(E.classifyLayer({...rows[5],observed_direction:"VIX_UP",raw_value:2},[q("VIX",300,"OFF_SESSION_SOURCE")],now).state,"EXCLUDED"));
check("No score or price prediction in core",()=>{assert.equal(typeof E.predict,"undefined");assert.equal(typeof E.tradeSignal,"undefined");});
const html=src("index.html");
check("All previous executive panels remain",()=>["id=\"deskMode\"","id=\"confluenceToday\"","id=\"analysisToday\"","id=\"directionalGraph\"","data-p=\"sistema\""].forEach(x=>assert.ok(html.includes(x),x)));
check("Automatic and manual toggles wired",()=>["rdTab-auto","rdTab-live","rdTab-event","rdModeSummary","rdPreWindows","rdSourceGate","relatedEvents"].forEach(x=>assert.ok(html.includes('id="'+x+'"'),x)));
check("No duplicated DOM ids",()=>{const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size);});
["app.js","ui_v2.js","live-hoje.js","event-monitor.js","cross-asset-core.js"].forEach(name=>{
 check("JS syntax "+name,()=>assert.doesNotThrow(()=>new vm.Script(src(name),{filename:name})));
});
console.log("PASS",total,"confluence, source quality and post-event safeguards");
