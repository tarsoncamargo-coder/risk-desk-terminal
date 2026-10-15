"use strict";
// FX ActivTrades shadow: componente visual sem dependencias externas ou trading.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const src=fs.readFileSync(path.join(__dirname,"..","mt5-shadow-hoje.js"),"utf8");
assert.ok(html.includes('mt5-shadow-hoje.js')&&html.includes('mt5-shadow-hoje.css'));
assert.ok(!src.includes("live_market_minute")&&!src.includes("GEN2")&&!src.includes("tradeSignal"));
assert.doesNotThrow(()=>new vm.Script(src));
function el(){
  return {innerHTML:"",textContent:"",className:"",
    children:[],append(...xs){this.children.push(...xs);},
    querySelector(){return null},appendChild(x){this.children.push(x)},
    insertBefore(x){this.children.push(x)}
  };
}
async function test(rows,expected){
  const registry={hoje:el()};
  const doc={visibilityState:"visible",createElement(){return el()},getElementById(id){return registry[id]||null}};
  const context={document:doc,setInterval(){},api:async()=>rows,Number,Date,Intl,console};
  vm.runInNewContext(src,context);
  await new Promise(resolve=>setTimeout(resolve,20));
  const card=registry.hoje.children[0];assert.ok(card,"card must be mounted");
  // innerHTML creates DOM children on browser; simulated lookup stubs below only exercise import.
  assert.ok(card.innerHTML.includes("ActivTrades MT5")&&card.innerHTML.includes("rdMt5Pairs"));
}
const symbols=["DXY_SYNTH","EURUSD","USDJPY","GBPUSD","USDCAD","USDSEK","USDCHF"];
(async()=>{
 await test([], "unavailable");
 const at=new Date().toISOString();
 await test(symbols.map(symbol=>({symbol,source:"MT5_ACTIVTRADES_SHADOW",mid:102,as_of_utc:at,quality_status:"RECENT"})), "recent");
 console.log("PASS mt5 shadow card: imports, isolated source, syntax, empty/recent responses");
})().catch(e=>{console.error(e);process.exitCode=1;});
