"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const Core=require("../options-core.js");
const code=fs.readFileSync(path.join(__dirname,"..","options-tab.js"),"utf8");

const sample=[
  "Gold (OG|GC) G3RV6 (0.84 DTE) vs 4127.3 (-50.0, Range: 90.0) at 23.64% Volatility",
  "Volatility\tDelta\tCall Settle\tCall\tStrike\tPut\tPut Settle\tDelta\tStraddle\tGamma\tVega\tTheta",
  "24.27\t0.72\t82.8\t35.8\t4100\t8.5\t5.5\t-0.28\t44.3\t0.007\t0.669\t-8.479",
  "24.05\t0.52\t62.3\t20.2\t4125\t17.9\t10.1\t-0.48\t38.0\t0.008\t0.789\t-17.861",
  "23.77\t0.32\t44.5\t9.6\t4150\t32.3\t17.2\t-0.68\t41.9\t0.008\t0.705\t-9.609",
  "Strike\tG3RV6\t1 DTE\tOG3V6\t2 DTE",
  "C\tP\tC\tP",
  "4100\t50\t400\t10\t20",
  "4125\t100\t150\t30\t40",
  "4150\t300\t80\t20\t10"
].join("\n");

const store=new Map();
const localStorage={
  getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)),
  removeItem:k=>store.delete(k)
};
function makeDom(){
  const els={};
  const ids=[];
  for(const a of ["MGC","MNQ"]){
    ids.push("optInput"+a,"optStatus"+a,"optResults"+a,"optHistory"+a,"optProcess"+a,"optClear"+a,"optClearHistory"+a,"optAuto"+a);
  }
  for(const id of ids){
    els[id]={
      id,value:"",innerHTML:"",textContent:"",onclick:null,
      dataset:{},
      querySelectorAll:()=>[]
    };
  }
  return {els,document:{visibilityState:"visible",getElementById:id=>els[id]||null}};
}
function boot(){
  const {els,document}=makeDom();
  const window={RiskDeskOptionsCore:Core};
  vm.runInNewContext(code,{window,document,localStorage,setInterval:()=>0,clearInterval:()=>{},Intl,Date,Number,String,Array,Math,JSON,encodeURIComponent,console});
  return els;
}

const first=boot();
first.optInputMGC.value=sample;
first.optProcessMGC.onclick();
assert.match(first.optStatusMGC.innerHTML,/cálculo salvo/);
assert.match(first.optResultsMGC.innerHTML,/PR/);
assert.match(first.optResultsMGC.innerHTML,/4\.127,3/);
assert.match(first.optHistoryMGC.innerHTML,/IV ATM/);
assert.match(first.optHistoryMGC.innerHTML,/Net GEX/);
assert.match(first.optHistoryMGC.innerHTML,/DP \+3/);
assert.match(first.optHistoryMGC.innerHTML,/Call OI no CW/);
assert.ok(store.has("riskdesk_options_latest_v2_MGC"));
assert.ok(store.has("riskdesk_options_history_v1_MGC"));

const second=boot();
assert.match(second.optStatusMGC.innerHTML,/RESULTADO RESTAURADO/);
assert.match(second.optResultsMGC.innerHTML,/ÚLTIMO CÁLCULO SALVO/);
assert.match(second.optResultsMGC.innerHTML,/4\.127,3/);
assert.equal(second.optInputMGC.value,sample);
assert.match(second.optHistoryMGC.innerHTML,/Delta Call/);
assert.match(second.optHistoryMGC.innerHTML,/Put OI no PW/);
console.log("PASS OPTIONS PERSISTENCE: latest result survives reload and history preserves full calculation");
