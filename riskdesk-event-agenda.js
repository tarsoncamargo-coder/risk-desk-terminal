/* J14I calendar: agenda oficial de pesquisa J13; só leitura e sem inferir Actual de horários programados. */
(function(){
"use strict";
const id="rdJ13Agenda";
const fmt=x=>{
 const t=Date.parse(x||"");
 return Number.isFinite(t)?new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",
  day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(t)):"—";
};
function text(tag,value,cls){
 const v=document.createElement(tag);v.textContent=String(value??"—");
 if(cls)v.className=cls;return v;
}
function desc(r){
 if(r.presentation_status==="OFFICIAL_ARCHIVE_CAPTURED_POST_RELEASE_RESEARCH")
  return "Comunicado oficial capturado (J13), "+r.captured_release_metrics+" medição(ões). Não é GEN1/GEN2.";
 if(r.presentation_status==="CALENDAR_SCHEDULED_NOT_RELEASED")
  return "Programado; resultado ainda não divulgado ou não integrado.";
 if(r.live_engine_registered)
  return "Há evento no motor LIVE; o comunicado J13 desta linha não foi comprovado nesta agenda.";
 return "Horário oficial registrado; sem resultado validado nesta camada.";
}
function item(r){
 const box=text("div","","rd-orch__line");
 const left=text("div","");
 left.append(text("div",r.event_name,"rd-orch__line-title"),
  text("div",fmt(r.event_ts_utc)+" BRT · "+r.source,"rd-orch__mini"));
 const right=text("div",desc(r),"rd-orch__line-content");
 box.append(left,right);return box;
}
async function go(){
 const root=document.getElementById(id);if(!root)return;
 try{
  if(typeof api!=="function")throw Error("source not available");
  const rows=await api("riskdesk_j14i_event_agenda_site_v1",
   "select=event_name,event_ts_utc,source,presentation_status,captured_release_metrics,live_engine_registered&order=event_ts_utc.asc&limit=30");
  if(!Array.isArray(rows)||!rows.length)throw Error("empty agenda");
  root.replaceChildren();
  root.append(text("div","Agenda oficial recente e próxima · J13","rd-orch__title"));
  root.append(text("p","PPI, vendas no varejo e demais calendários têm cobertura independente. A falta de Actual validado NÃO vira zero ou previsão.","rd-orch__subtitle"));
  const list=text("div","","rd-orch__list");
  for(const r of rows)list.append(item(r));
  root.append(list,text("div","Programação de BLS/Census não comprova coleta no minuto do release nem autoriza estratégias.","rd-orch__note"));
 }catch(_){
  root.replaceChildren(text("p","Agenda J13 indisponível no momento; confira os demais módulos sem presumir resultados.","rd-orch__warning"));
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();
setInterval(()=>{if(document.visibilityState!=="hidden")go();},600000);
})();