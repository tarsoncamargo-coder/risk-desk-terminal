"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const core={};vm.runInNewContext(read("cross-asset-core.js"),{window:core,globalThis:core});
function mkEl(){
 const listeners={};
 return {innerHTML:"",textContent:"",attrs:{},hidden:false,
  classList:{toggle(){},add(){},remove(){}},
  setAttribute(k,v){this.attrs[k]=v},
  addEventListener(type,fn){listeners[type]=fn},
  insertAdjacentHTML(where,s){this.innerHTML=s+this.innerHTML},
  fire(type){if(!listeners[type])throw Error("Missing listener "+type);listeners[type]();}
 };
}
function q(asset,age,quality="OK"){return {asset,source:"TEST",ts_utc:new Date(Date.now()-age*60000).toISOString(),quality_status:quality};}
async function runScenario(){
 const els={};
 for(const id of ["rdMarketNow","rdPostFlow","rdPostDiagnostics","rdEventMap","rdTab-auto","rdTab-event","rdTab-live",
      "rdModeSummary","rdEventEvidenceGate","rdSourceGate","rdPreWindows","refresh"])
   els[id]=mkEl();
 const event={event_id:"EV",event_family:"CPI",scheduled_ts_utc:new Date(Date.now()+60*60000).toISOString(),
  source_status:"SCHEDULED",actual:null,consensus:null,available_at:null,actual_source:null,consensus_source:null};
 const data={
  riskdesk_product_directional_matrix_v1:[
   {event_id:"EV",layer_key:"EVENT",label:"Evento",raw_value:null,observed_direction:"AGUARDANDO",market_window:"LIVE",product_status:"LEITURA_DISPONIVEL"},
   {event_id:"EV",layer_key:"NQ",label:"Nasdaq",raw_value:-0.3,observed_direction:"DOWN",market_window:"LIVE",product_status:"LEITURA_DISPONIVEL",value_unit:"PCT"},
   {event_id:"EV",layer_key:"US2Y",label:"2Y / ZT proxy",raw_value:-0.02,observed_direction:"DOWN",market_window:"LIVE",product_status:"LEITURA_DISPONIVEL",value_unit:"PCT"},
   {event_id:"EV",layer_key:"DXY",label:"DXY",raw_value:0.12,observed_direction:"UP",market_window:"LIVE",product_status:"LEITURA_DISPONIVEL",value_unit:"PCT"},
   {event_id:"EV",layer_key:"ZQ",label:"ZQ",raw_value:0.01,observed_direction:"UP",market_window:"LIVE",product_status:"LEITURA_DISPONIVEL",value_unit:"PCT"}
  ],
  riskdesk_live_latest_quotes_v1:[q("NQ",1),q("ZT",1),q("DXY",11),q("ZQ",28)],
  riskdesk_product_current_event_v1:[],
  riskdesk_product_next_event_v1:[event],
  riskdesk_product_current_semantic_v1:[],
  riskdesk_product_current_gen1_v1:[],
  riskdesk_product_current_gen2_shadow_v1:[],
  riskdesk_product_system_health_v1:[{component:"GEN1_CONTEXT",age_minutes:0.2,status:"WARMUP"}],
  riskdesk_product_market_state_v2_v1:[
   {event_id:"EV",window:"PRE1440",product_status:"AGUARDANDO_JANELA",as_of_utc:new Date().toISOString()},
   {event_id:"EV",window:"PRE60",product_status:"AGUARDANDO_JANELA",as_of_utc:new Date().toISOString()}
  ],
  live_pipeline_heartbeat:[
   {component:"EVENT_ENGINE",status:"OK",last_seen_utc:new Date().toISOString(),details:{bls_actual_mode:"UNREGISTERED_V1_LIMITED"}},
   {component:"GEN1_CONTEXT",status:"WARMUP",last_seen_utc:new Date().toISOString(),details:{state:"NO_CURRENT_GEN1_EVENT_CONTEXT"}},
   {component:"GEN2_SHADOW",status:"WARMUP",last_seen_utc:new Date().toISOString(),details:{state:"HISTORICAL_OR_STALE_NOT_ELIGIBLE_FOR_J12"}}
  ]
 };
 vm.runInNewContext(read("event-monitor.js"),{
  window:core,document:{visibilityState:"visible",getElementById:id=>els[id]||null},
  api:async p=>data[p]||[],esc:x=>String(x??"").replace(/&/g,"&amp;").replace(/</g,"&lt;"),
  utc:s=>new Date(s).toISOString(),setInterval:()=>{}
 });
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.ok(els.rdModeSummary.innerHTML.includes("PRE-PRICING"));
 assert.ok(els.rdMarketNow.innerHTML.includes("SPARSE"));
 assert.ok(els.rdMarketNow.innerHTML.includes("DELAYED"));
 assert.ok(els.rdMarketNow.innerHTML.includes("YIELD"));
 assert.ok(els.rdMarketNow.innerHTML.includes("CONTEXTO / NÃO OPERACIONAL"));
 assert.equal((els.rdMarketNow.innerHTML.match(/class="rv-dot /g)||[]).length,2,"Only fresh NQ/ZT should have markers");
 assert.ok(els.rdSourceGate.innerHTML.includes("UNREGISTERED_V1_LIMITED"));
 assert.ok(els.rdPreWindows.innerHTML.includes("PRE1440")&&els.rdPreWindows.innerHTML.includes("PRE5"));
 assert.ok(els.rdPostFlow.innerHTML.includes("PRE60"));
 assert.ok(els["rdTab-auto"].attrs["aria-pressed"]==="true");
 assert.ok(els.rdModeSummary.innerHTML.includes("PRE-PRICING"));
 els["rdTab-event"].fire("click");
 assert.equal(els["rdTab-event"].attrs["aria-pressed"],"true");
 els["rdTab-auto"].fire("click");
 assert.equal(els["rdTab-auto"].attrs["aria-pressed"],"true");
 console.log("PASS UI: auto/manual PRE mode, pre windows, source gate and stale suppression");
}
runScenario().catch(e=>{console.error(e);process.exitCode=1;});
