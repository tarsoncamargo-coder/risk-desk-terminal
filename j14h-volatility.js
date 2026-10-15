/* J14H — volatilidade Nasdaq, leitura de qualidade apenas.
    VXN prioritario; VIX opcional; sigma realizada do NQ e um calculo distinto.
    Sem distribuicao de valores Cboe, sem probabilidade de acerto. */
(function(){
"use strict";
const healthUrl="https://pkmjknlbsptqhanejddm.supabase.co/functions/v1/riskdesk-j14a-health-panel";
const macroUrl="https://pkmjknlbsptqhanejddm.supabase.co/functions/v1/riskdesk-j14c-continuous-context";
const tz="America/Sao_Paulo";
function cell(tag,value,cls){
 const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=String(value??"—");return e;
}
function fmtDate(value){
 if(!value)return "sem observação";
 const t=new Date(value);return Number.isFinite(t.getTime())?
 new Intl.DateTimeFormat("pt-BR",{timeZone:tz,dateStyle:"short",timeStyle:"short"}).format(t):"inválido";
}
async function getJson(url){
 const res=await fetch(url,{method:"GET",cache:"no-store",
  headers:{"Accept":"application/json"},signal:AbortSignal.timeout(11000)});
 if(!res.ok)throw Error("SOURCE_HTTP_"+res.status);
 return await res.json();
}
async function render(){
 const target=document.getElementById("j14hNasdaqVol");
 if(!target)return;
 try{
  const [h,c]=await Promise.all([getJson(healthUrl),getJson(macroUrl)]);
  const vx=h.rows?.find(x=>x.item_key==="ASSET_VXN");
  const vi=h.rows?.find(x=>x.item_key==="ASSET_VIX");
  if(!vx||!vi||!c.context)throw Error("MISSING_ROWS");
  target.replaceChildren();
  target.append(cell("div","VXN — indicador prioritário da volatilidade implícita do Nasdaq-100","ct"));
  const vxAge=(Date.now()-Date.parse(vx.last_market_ts_utc))/60000;
  const quality=Number.isFinite(vxAge)&&vxAge>=-2&&vxAge<=20?
   "Fonte com atraso; não comprovadamente em tempo real":
   "Última observação histórica / não utilizável como intradiário";
  target.append(cell("p",fmtDate(vx.last_market_ts_utc)+" (Brasília). "+quality+". Origem: "+vx.source_name+".","muted"));
  const source=document.createElement("a");source.href="https://fred.stlouisfed.org/series/VXNCLS";
  source.target="_blank";source.rel="noopener noreferrer";
  source.textContent="VXNCLS — fechamento diário oficial divulgado no FRED/Cboe ↗";
  target.append(source);
  target.append(cell("div","Sigma realizada do NQ: "+(c.context.sigma_quality||"não apurada").replaceAll("_"," ")+
   ". Mede volatilidade de preços passados; NÃO é a IV de opções nem o VXN.","muted"));
  target.append(cell("div","VIX (S&P 500): confirmação secundária e opcional; última observação "+
   fmtDate(vi.last_market_ts_utc)+". Sem peso no viés comprador/vendedor do Nasdaq.","muted"));
 }catch(_){
  target.replaceChildren(cell("p","Qualidade VXN indisponível. A sigma realizada e o VXN não podem ser considerados atualizados sem os dados.","muted"));
 }
}
document.addEventListener("DOMContentLoaded",render);
setInterval(render,300000);
})();