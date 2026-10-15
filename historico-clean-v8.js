/* Historico CLEAN V8 — arquivo de pesquisa, nunca sinal LIVE ou input de GEN1/GEN2. */
(function(){
"use strict";
const root=document.getElementById("rdCleanV8");
if(!root)return;
const yearEl=document.getElementById("rdHistYear"),
 searchEl=document.getElementById("rdHistSearch"),
 impEl=document.getElementById("rdHistImpact"),
 tbody=document.getElementById("rdHistTable"),
 statusEl=document.getElementById("rdHistStatus"),
 pageEl=document.getElementById("rdHistPage"),
 prev=document.getElementById("rdHistPrev"),
 next=document.getElementById("rdHistNext"),
 live=document.getElementById("rdHistLiveComparison");
let manifest=null,yearData=[],page=0,fetchToken=0,initialized=false;
const cache=new Map(),PAGE_SIZE=30;
function msg(text){statusEl.textContent=text;}
function fmt(x){return x==null||!Number.isFinite(Number(x))?"—":new Intl.NumberFormat("pt-BR",{maximumFractionDigits:4}).format(Number(x));}
function brazil(iso){const date=new Date(iso);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(date):"—";}
function same(s,q){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").includes(q);}
function rowNode(values){
 const tr=document.createElement("tr");
 [brazil(values[0]),values[1],String(values[2])+"★",fmt(values[3]),fmt(values[4]),fmt(values[5]),fmt(values[6])].forEach(value=>{
   const td=document.createElement("td");td.textContent=value;tr.appendChild(td);
 });
 return tr;
}
function render(){
 tbody.replaceChildren();
 const query=searchEl.value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
 const impact=impEl.value;
 const filtered=yearData.filter(x=>(!impact||String(x[2])===impact)&&(!query||same(x[1],query)));
 const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 page=Math.min(page,pages-1);
 const fragment=document.createDocumentFragment();
 filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).forEach(x=>fragment.appendChild(rowNode(x)));
 tbody.appendChild(fragment);
 if(!filtered.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=7;td.textContent="Nenhum registro para estes filtros.";tr.appendChild(td);tbody.appendChild(tr);}
 pageEl.textContent="Página "+(page+1)+"/"+pages+" · "+filtered.length+" evento(s) no ano "+yearEl.value;
 prev.disabled=page===0;next.disabled=page>=pages-1;
 msg("ARQUIVO HISTÓRICO CLEAN V8 · "+yearData.length+" registros do ano "+yearEl.value+" · não comprova coleta LIVE");
}
async function loadYear(y){
 const current=++fetchToken;
 msg("Carregando arquivo histórico "+y+"...");
 try{
   let rows=cache.get(y);
   if(!rows){
     const resp=await fetch("data/historico-clean-v8/"+encodeURIComponent(y)+".json",{cache:"no-store"});
     if(!resp.ok)throw Error("HTTP "+resp.status);
     rows=await resp.json();
     if(!Array.isArray(rows)||rows.length!==manifest.years[y]||rows.some(r=>!Array.isArray(r)||r.length!==7||!String(r[0]).startsWith(y)))throw Error("Falha de integridade do arquivo "+y);
     cache.set(y,rows);
   }
   if(fetchToken!==current)return;
   yearData=rows;page=0;render();
 }catch(e){if(fetchToken!==current)return;yearData=[];tbody.replaceChildren();msg("ERRO AO CARREGAR HISTÓRICO: "+String(e.message||e));pageEl.textContent="Sem dados";}
}
async function liveStatus(){
 if(!live||typeof api!=="function")return;
 try{
  const rows=await api("riskdesk_product_latest_released_event_v1","select=*");
  const e=rows&&rows[0];
  if(!e){live.textContent="Nenhum release BLS registrado no sistema.";return;}
  const released=Date.parse(e.scheduled_ts_utc),saved=Date.parse(e.available_at);
  const lag=Number.isFinite(released)&&Number.isFinite(saved)?Math.round((saved-released)/60000):null;
  live.textContent="Último registro BLS: "+(e.event_family||"EVENTO")+" · previsto "+brazil(e.scheduled_ts_utc)+" · registrado "+brazil(e.available_at)+
    (lag==null?"":" · intervalo até o registro: "+lag+" min")+
    ". Esse intervalo NÃO mede necessariamente a latência da fonte; não comprova acompanhamento prospectivo.";
 }catch(e){live.textContent="Registro BLS não acessível: "+String(e.message||e);}
}
async function init(){
 if(initialized)return;
 initialized=true;
 try{
  const r=await fetch("data/historico-clean-v8/manifest.json",{cache:"no-store"});
  if(!r.ok)throw Error("Manifest HTTP "+r.status);
  manifest=await r.json();
  if(manifest.schema!=="RD_CLEAN_V8_VISUAL_HISTORICAL_ONLY_V1"||manifest.rows!==10290)throw Error("Manifesto desconhecido");
  const years=Object.keys(manifest.years).sort().reverse();
  years.forEach(y=>{const o=document.createElement("option");o.value=y;o.textContent=y+" · "+manifest.years[y]+" eventos";yearEl.appendChild(o);});
  yearEl.value=years[0];
  await Promise.all([loadYear(yearEl.value),liveStatus()]);
 }catch(e){msg("HISTÓRICO INDISPONÍVEL: "+String(e.message||e));}
}
yearEl.addEventListener("change",()=>loadYear(yearEl.value));
searchEl.addEventListener("input",()=>{page=0;render();});
impEl.addEventListener("change",()=>{page=0;render();});
prev.addEventListener("click",()=>{if(page>0){page--;render();}});
next.addEventListener("click",()=>{page++;render();});
const tab=document.querySelector('button[data-p="historico"]');
if(tab)tab.addEventListener("click",init);
if(document.getElementById("historico")?.classList.contains("on"))init();
setInterval(()=>{if(initialized&&document.visibilityState!=="hidden"&&document.getElementById("historico")?.classList.contains("on"))liveStatus();},60000);
})();