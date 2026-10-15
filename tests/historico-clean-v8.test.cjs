"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const manifest=JSON.parse(read("data/historico-clean-v8/manifest.json"));
assert.equal(manifest.rows,10290);
assert.equal(manifest.unique_minutes,4552);
assert.equal(manifest.forecast_asof,"UNVERIFIED");
assert.equal(manifest.candidate_v11_imported,false);
let total=0,unique=new Set();
for(const [year,expected] of Object.entries(manifest.years)){
 const list=JSON.parse(read("data/historico-clean-v8/"+year+".json"));
 assert.equal(list.length,expected,"Rows "+year);total+=list.length;
 list.forEach(r=>{
  assert.equal(r.length,7);assert.ok(r[0].startsWith(year));
  assert.ok(r[2]===2||r[2]===3);
  const id=r[0]+"|"+r[1]+"|"+r[3]+"|"+r[4]+"|"+r[5];
  assert.ok(!unique.has(id),"Unexpected duplicate record");unique.add(id);
  if(r[3]!=null&&r[4]!=null&&r[6]!=null)assert.ok(Math.abs((r[3]-r[4])-r[6])<.00001);
 });
}
assert.equal(total,10290);
const code=read("historico-clean-v8.js");
assert.doesNotThrow(()=>new vm.Script(code));
assert.ok(!code.includes('api("gen1_')&&!code.includes('api("gen2_'));
const html=read("index.html");
for(const name of ["rdHistYear","rdHistSearch","rdHistImpact","rdHistTable","rdHistStatus","rdHistLiveComparison"])assert.ok(html.includes('id="'+name+'"'));
assert.ok(html.includes("NÃO IMPORTAR")&&html.includes("GEN1/GEN2"));
const objs={};
function node(){const listeners={};return {value:"",textContent:"",children:[],disabled:false,attrs:{},classList:{contains:s=>s==="on"},addEventListener:(e,f)=>listeners[e]=f,fire:e=>listeners[e]?.(),appendChild(o){this.children.push(o)},replaceChildren(){this.children=[]},setAttribute(k,v){this.attrs[k]=v}};}
for(const id of ["rdCleanV8","rdHistYear","rdHistSearch","rdHistImpact","rdHistTable","rdHistStatus","rdHistPage","rdHistPrev","rdHistNext","rdHistLiveComparison","historico"])objs[id]=node();
objs.rdHistImpact.value="";
const document={getElementById:id=>objs[id]||null,querySelector:q=>q.includes("historico")?node():null,createElement:()=>node(),createDocumentFragment:()=>node(),visibilityState:"visible"};
vm.runInNewContext(code,{document,fetch:async name=>({ok:true,json:async()=>JSON.parse(read(name))}),api:async()=>[{event_family:"CPI",scheduled_ts_utc:"2026-10-14T12:30:00Z",available_at:"2026-10-14T21:56:37Z"}],setInterval:()=>{},Intl,Date,Number,Math,String,Map,Array,JSON,encodeURIComponent,console});
setTimeout(()=>{
 try{
  assert.equal(objs.rdHistYear.value,"2026");
  assert.ok(objs.rdHistStatus.textContent.includes("828 registros"));
  assert.equal(objs.rdHistTable.children.length,1);
  assert.equal(objs.rdHistTable.children[0].children.length,30);
  assert.match(objs.rdHistLiveComparison.textContent,/NÃO mede necessariamente/);
  console.log("PASS CLEAN V8: 10.290 eventos, arquivo íntegro, status, filtros e isolamento dos modelos");
 }catch(e){console.error(e);process.exitCode=1}
},80);