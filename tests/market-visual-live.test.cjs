"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const source=read("market-visual-live.js"),app=read("app.js"),html=read("index.html");
assert.doesNotThrow(()=>new vm.Script(app,{filename:"app.js"}));
assert.doesNotThrow(()=>new vm.Script(source,{filename:"market-visual-live.js"}));
assert.ok(app.includes("Promise.allSettled("),"independent queries");
assert.ok(app.includes("load(true);},60000)"),"main live refresh");
assert.ok(!app.includes("async function load(){$(\"conn\")"),"old loader replaced");
assert.ok(html.includes("rdMarketVisualHoje")&&html.includes("rdMarketVisualNasdaq"));
assert.ok(!source.includes("live_market_state")&&!source.includes("tradeSignal"));
function node(){return {children:[],className:"",textContent:"",append(...xs){this.children.push(...xs)},replaceChildren(...xs){this.children=xs}};}
const root={rdMarketVisualHoje:node(),rdMarketVisualNasdaq:node()};
const now=new Date().toISOString(),old=new Date(Date.now()-17*60000).toISOString();
const q=[
 {asset:"NQ",price:25432.5,ts_utc:now,quality_status:"OK"},
 {asset:"ZT",price:102.322,ts_utc:now,quality_status:"OK"},
 {asset:"ZN",price:112.3,ts_utc:now,quality_status:"OK"},
 {asset:"ZQ",price:96.2,ts_utc:old,quality_status:"OK"},
 {asset:"DXY",price:101.1,ts_utc:old,quality_status:"STALE"},
 {asset:"VIX",price:16.1,ts_utc:old,quality_status:"OFF_SESSION_SOURCE"},
 {asset:"VXN",price:20.3,ts_utc:old,quality_status:"OFF_SESSION_SOURCE"}
];
const s=[{symbol:"DXY_SYNTH",mid:102.08464,as_of_utc:now,quality_status:"RECENT"}];
const intervals=[];
vm.runInNewContext(source,{
 document:{visibilityState:"visible",getElementById:id=>root[id]||null,createElement:node},
 api:async table=>table==="riskdesk_mt5_fx_shadow"?s:q,
 setInterval:(callback,time)=>intervals.push(time),
 Intl,Date,Number,console
});
setTimeout(()=>{
 try{
   assert.deepEqual(intervals,[30000,10000]);
   for(const target of Object.values(root)){
     assert.equal(target.children.length,3);
     const cards=target.children[1].children;
     assert.equal(cards.length,8);
     assert.equal(cards[4].children[0].textContent,"DXY ActivTrades");
     assert.match(cards[4].children[2].textContent,/ATUALIZADO/);
     assert.match(cards[5].children[2].textContent,/ATRASADO/);
     assert.match(cards[6].children[2].textContent,/FORA DA SESSÃO/);
     assert.match(target.children[2].textContent,/não substitui DXY Yahoo/);
   }
   console.log("PASS: visual LIVE separado, fontes, freshness e atualização periódica");
 }catch(err){console.error(err);process.exitCode=1;}
},40);
