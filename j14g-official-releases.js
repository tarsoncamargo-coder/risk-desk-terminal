/* J14G -- leitura pública isolada de comunicados oficiais já capturados pelo J13.
   Não alimenta LIVE, GEN1, GEN2, Market State, Laranjinha ou backtest. */
(function () {
"use strict";
const API="https://pkmjknlbsptqhanejddm.supabase.co/functions/v1/riskdesk-j14g-official-macro-releases";
const targets=["j14gOfficialHoje","j14gOfficialEvento"];
const ptDate=(raw)=>{
 if(!raw)return "—";
 const date=new Date(raw);
 return Number.isFinite(date.valueOf())?
 new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"}).format(date):"—";
};
const txt=(tag,value,className)=>{
 const node=document.createElement(tag);
 node.textContent=String(value??"—");
 if(className)node.className=className;
 return node;
};
const item=(label,value)=>{
 const div=document.createElement("div");
 div.style.margin="7px 0";
 div.append(txt("strong",label+": "),txt("span",value));
 return div;
};
const fnum=(n)=>{
 if(n===null||n===undefined||n==="")return null;
 const val=Number(n);
 return Number.isFinite(val)?val.toLocaleString("pt-BR",{maximumFractionDigits:3}):null;
};
const draw=(root,event)=>{
 root.replaceChildren();
 const name=txt("div",event.event_name+" — "+event.reference_period,"ct");
 name.style.marginBottom="8px";
 root.append(name);
 const act=fnum(event.actual_num);
 root.append(item("Resultado capturado",act===null?"Indisponível":act+" "+event.actual_unit+" ("+event.actual_measure+")"));
 root.append(item("Horário previsto",ptDate(event.scheduled_ts_utc)));
 root.append(item("Primeira captura registrada",ptDate(event.first_observed_at_utc)+
  " (+"+fnum(event.first_observed_delay_minutes)+" min após a divulgação programada)"));
 root.append(item("Consenso",fnum(event.consensus_num)===null?"Não registrado/validado no J13":fnum(event.consensus_num)));
 root.append(item("Surpresa",fnum(event.surprise_num)===null?"Indisponível — não inferida":fnum(event.surprise_num)));
 const doc=event.official_document_validated?
   "Comunicado BLS corresponde à data e ao mês de referência":"Documento sem verificação completa";
 root.append(txt("p",doc+"; extração automática requer conferência cruzada. "+
  (event.asof_first_publication_proven?"Captura no minuto da divulgação comprovada.":
  "Não há prova de captura no primeiro minuto."),"muted"));
 if(!event.in_live_event_state){
  const warn=txt("p","PPI NÃO ENTROU NO MOTOR LIVE: esta é uma leitura pós-divulgação do J13. "+
   "Não existem previsões GEN1/GEN2, confluência pós-evento ou reação do Nasdaq validadas para este registro.","muted");
  warn.style.borderLeft="3px solid #d0a24c";
  warn.style.paddingLeft="10px";root.append(warn);
 }
 const notice=txt("p",event.event_context_notice,"muted");root.append(notice);
 if(typeof event.official_release_url==="string"&&
    /^https:\/\/www\.bls\.gov\/news\.release\/archives\/ppi_[0-9]{8}\.htm$/.test(event.official_release_url)){
  const a=txt("a","Ler comunicado oficial do BLS ↗");
  a.href=event.official_release_url;a.target="_blank";a.rel="noopener noreferrer";
  root.append(a);
 }
};
async function refresh(){
 const roots=targets.map(id=>document.getElementById(id)).filter(Boolean);
 if(!roots.length)return;
 try{
  const r=await fetch(API,{method:"GET",cache:"no-store",
   headers:{"Accept":"application/json"},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error("Fonte J13 indisponível");
  const payload=await r.json();
  if(!Array.isArray(payload.events)||!payload.events.length)throw Error("Sem comunicado capturado");
  const latest=payload.events.find(x=>x.metric_code==="PPI_FINAL_DEMAND_MOM_SA")||payload.events[0];
  for(const root of roots)draw(root,latest);
 }catch(_){
  for(const root of roots){root.replaceChildren(txt("span","Não foi possível consultar as publicações oficiais J13 agora; nenhum dado será inventado.","muted"));}
 }
}
document.addEventListener("DOMContentLoaded",refresh);
setInterval(refresh,600000);
})();