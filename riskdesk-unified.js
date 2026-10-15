/* J14I: orquestrador SOMENTE DE LEITURA de fontes e progresso do Risk Desk.
   Nunca entrega sinais, probabilidades de lucro ou ordens.
   Reusa APIs RLS e as abas existentes, sem modificar motores CORE.
*/
(function(){
"use strict";
const PREFIX="https://pkmjknlbsptqhanejddm.supabase.co/functions/v1/";
const URLS={
 health:PREFIX+"riskdesk-j14a-health-panel",
 bias:PREFIX+"riskdesk-j14c-continuous-context",
 zq:PREFIX+"riskdesk-j14e-zq-calendar-weighted",
 official:PREFIX+"riskdesk-j14g-official-macro-releases"
};
const IDS=["rdUnifiedPulse","rdUnifiedMacro","rdUnifiedNasdaq","rdUnifiedEvent","rdUnifiedArchive","rdUnifiedProject"];
const TZ="America/Sao_Paulo";
const $=id=>document.getElementById(id);
const elt=(tag,cls,content)=>{
 const e=document.createElement(tag);
 if(cls)e.className=cls;
 if(content!==undefined)e.textContent=String(content);
 return e;
};
function fmtDate(x){
 const t=Date.parse(x||"");
 return Number.isFinite(t)?new Intl.DateTimeFormat("pt-BR",{timeZone:TZ,dateStyle:"short",timeStyle:"short"}).format(new Date(t)):"—";
}
function num(x,d=0){
 const n=Number(x);
 return (x===null||x===undefined||x===""||!Number.isFinite(n))?"—":
  n.toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
}
function shortText(s){return String(s||"").replaceAll("_"," ").replace(/\s+/g," ").trim();}
function elapsedMin(date){
 const t=Date.parse(date||"");
 return Number.isFinite(t)?(Date.now()-t)/60000:null;
}
function recent(date,threshold){
 const n=elapsedMin(date);
 return n!==null&&n>=-2&&n<=threshold;
}
function statusClass(s){
 return s==="COMPRADOR"?"rd-orch__positive":s==="VENDEDOR"?"rd-orch__negative":
 s==="NEUTRO"?"rd-orch__warning":"rd-orch__muted";
}
function section(root,title,subtitle,stamp){
 root.replaceChildren();
 const head=elt("div","rd-orch__head");
 const wrap=elt("div");
 wrap.append(elt("div","rd-orch__title",title),elt("div","rd-orch__subtitle",subtitle));
 head.append(wrap,elt("div","rd-orch__stamp",stamp||""));
 root.append(head);
 return root;
}
function grid(root,items,cols){
 const g=elt("div","rd-orch__grid"+(cols===3?" rd-orch__grid--three":""));
 for(const i of items){
  const card=elt("div","rd-orch__tile");
  const label=elt("div","rd-orch__key",i.label);
  const value=elt("div","rd-orch__value"+(i.large?" rd-orch__value--large":"")+(i.clas?" "+i.clas:""),i.value);
  card.append(label,value,elt("div","rd-orch__detail",i.detail||""));
  g.append(card);
 }
 root.append(g);
}
function note(root,msg,kind){
 root.append(elt("div","rd-orch__note"+(kind==="alert"?" rd-orch__note--alert":""),msg));
}
function jump(root,tgt,label){
 const box=elt("div","rd-orch__links");
 const button=elt("button",null,label);button.type="button";
 button.addEventListener("click",()=>{
  const nav=document.querySelector('nav button[data-p="'+tgt+'"]');
  if(nav){nav.click();window.scrollTo({top:0,behavior:"smooth"});}
 });
 box.append(button);root.append(box);
}
function external(root,items){
 const box=elt("div","rd-orch__links");
 for(const i of items){
  const a=elt("a",null,i.text);
  a.href=i.href;a.rel="noopener noreferrer";a.target="_blank";
  box.append(a);
 }
 root.append(box);
}
function row(root,name,content){
 const r=elt("div","rd-orch__line");
 r.append(elt("div","rd-orch__line-title",name),elt("div","rd-orch__line-content",content));
 root.append(r);return r;
}
async function fetchJson(url){
 const c=new AbortController();
 const tm=setTimeout(()=>c.abort(),11000);
 try{
  const r=await fetch(url,{method:"GET",cache:"no-store",headers:{Accept:"application/json"},signal:c.signal});
  if(!r.ok)throw Error("HTTP_"+r.status);
  return await r.json();
 }finally{clearTimeout(tm);}
}
async function fetchProgress(){
 if(typeof api!=="function")throw Error("Supabase not wired");
 const r=await api("riskdesk_j14i_delivery_progress_site_v1","select=*&singleton_id=eq.1&limit=1");
 if(!Array.isArray(r)||r.length!==1)throw Error("progress missing");
 return r[0];
}
async function fetchManifest(){
 const r=await fetch("data/historico-clean-v8/manifest.json",{cache:"no-store"});
 if(!r.ok)throw Error("manifest failed");
 const m=await r.json();
 if(m.schema!=="RD_CLEAN_V8_VISUAL_HISTORICAL_ONLY_V1"||m.rows!==10290)throw Error("manifest integrity");
 return m;
}
function get(a,n){return a?.rows?.find(r=>r.item_key===n)||null;}
function state(a){return a?.diagnostic_status||"SEM LEITURA";}
function labelReason(code){
 return ({
 NQ_DATA_NOT_FRESH:"NQ sem preço recente",
 INSUFFICIENT_FRESH_MACRO_SOURCES:"Pelo menos duas fontes macro não estão validadas",
 SIGMA_NOT_VALIDATED:"Sigma realizada do NQ ainda insuficiente",
 MACRO_MIXED_OR_NOT_CONFIRMED:"Confluência macro contraditória",
 NQ_15M_WITHOUT_DIRECTION:"NQ sem direção definida na janela",
 NQ_AND_AT_LEAST_TWO_MACRO_FACTORS_ALIGNED:"NQ e ao menos dois fatores macro alinhados",
 SNAPSHOT_OVER_7_MINUTES_OLD:"Leitura de confluência atrasada"
 })[code]||shortText(code)||"Sem informação";
}
function meter(a){
 if(!a)return "Sem coleta";
 if(a.last_market_ts_utc){
  const age=elapsedMin(a.last_market_ts_utc);
  return fmtDate(a.last_market_ts_utc)+" · "+(age!==null?num(age,1)+" min":"idade indisponível");
 }
 return "Nenhum timestamp válido";
}
function labelAsset(asset,health){
 if(!asset)return "Aguardando";
 const t=asset.last_market_ts_utc;
 const age=elapsedMin(t);
 if(age===null||age < -2)return "Horário inválido";
 if(asset.item_key==="ASSET_DXY_MT5_SHADOW")return age<=2&&asset.diagnostic_status==="MT5_RECENT_FORMULA_VERIFIED_SHADOW"?"MT5 recente (Shadow)":"MT5 atrasado/qualidade pendente";
 if(asset.item_key==="ASSET_VXN"||asset.item_key==="ASSET_VIX")return age>20?"Sem leitura intradiária atual":"Atrasado / contexto somente";
 if(age>5&&asset.item_key!=="ASSET_ZQ")return "Sem barra recente";
 if(asset.item_key==="ASSET_ZQ")return age>15?"ZQ negociado atrasado":"CME recente (pesquisa)";
 return asset.diagnostic_status==="RECENT_CME_MARKET_BAR"?"Barra recente":"Verificar fonte";
}
function viewBias(context){
 const c=context?.context;
 const age=elapsedMin(c?.assessed_at_utc);
 const quality=context?.status==="SHADOW_CONTEXT_RESEARCH"&&age!==null&&age>=-2&&age<=7;
 return {value:quality?c.continuous_bias:"NEUTRO",
  qualified:quality,reason:quality?labelReason(c.reason_code):(c?labelReason(c.reason_code):"Sem leitura"),
  coverage:c?String(c.fresh_sources)+" / "+String(c.total_sources):"—",
  sigma:c?.sigma_quality||"SEM LEITURA",time:c?.assessed_at_utc||null};
}
function showPulse(D){
 const root=$("rdUnifiedPulse");if(!root)return;
 const b=viewBias(D.bias);
 const items=D.health?.rows||[];
 const nq=get(D.health,"ASSET_NQ"),zt=get(D.health,"ASSET_ZT"),zn=get(D.health,"ASSET_ZN");
 const dxy=get(D.health,"ASSET_DXY_MT5_SHADOW"),vx=get(D.health,"ASSET_VXN");
 const official=D.official?.events?.find(x=>x.metric_code==="PPI_FINAL_DEMAND_MOM_SA");
 section(root,"Radar de mercado · Nasdaq","Condições contínuas de mercado, fora e dentro das janelas de eventos. Contexto, não ordem.",
 "Radar "+fmtDate(b.time));
 grid(root,[
  {label:"Viés contextual",value:b.value+(b.qualified?"":" · NÃO VALIDADO"),detail:b.reason,clas:statusClass(b.value),large:true},
  {label:"Fontes macro / NQ",value:b.coverage,detail:"NQ · ZT · ZN · DXY MT5; cobertura não é probabilidade."},
  {label:"Juros e DXY",value:[zt,zn,dxy].filter(a=>a&&
   (a.diagnostic_status==="RECENT_CME_MARKET_BAR"||
   (a.diagnostic_status==="MT5_RECENT_FORMULA_VERIFIED_SHADOW"&&recent(a.last_market_ts_utc,2)))).length+"/3 atualizados",
   detail:"ZT/ZN são futuros, não taxas 2Y/10Y; MT5 ainda Shadow."},
  {label:"VXN / volatilidade",value:labelAsset(vx),detail:"VXN é implícita; sigma realizada do NQ é separada."}
 ]);
 note(root,"Leitura LIVE: "+(nq?labelAsset(nq):"NQ indisponível")+
  ". PPI oficial "+(official?num(official.actual_num,1)+"% capturado "+fmtDate(official.first_observed_at_utc):"ainda não disponível nesta fonte")+
  "; a captura pós-divulgação não comprova primeira publicação nem alimenta GEN1/GEN2.");
 const links=elt("div","rd-orch__links");
 for(const t of [["macro","Detalhes macro"],["nasdaq","Análise Nasdaq"],["evento","Eventos"],["historico","Histórico CLEAN"]]){
  const b=elt("button",null,t[1]);b.type="button";b.addEventListener("click",()=>{
   const btn=document.querySelector('nav button[data-p="'+t[0]+'"]');if(btn)btn.click();
   window.scrollTo({top:0,behavior:"smooth"});
  });links.append(b);
 }
 root.append(links);
}
function showMacro(D){
 const root=$("rdUnifiedMacro");if(!root)return;
 const b=viewBias(D.bias),h=D.health,z=D.zq?.rows?.find(x=>x.month_kind==="TRACKED_ZQ_CONTRACT");
 const rows=[
  ["NQ · direção confirmadora",get(h,"ASSET_NQ")],
  ["ZT · futuro Treasury 2 anos",get(h,"ASSET_ZT")],
  ["ZN · futuro Treasury 10 anos",get(h,"ASSET_ZN")],
  ["DXY sintético · MetaTrader 5",get(h,"ASSET_DXY_MT5_SHADOW")],
  ["ZQ negociado na CME",get(h,"ASSET_ZQ")],
  ["VXN · volatilidade Nasdaq",get(h,"ASSET_VXN")],
  ["VIX · mercado amplo (opcional)",get(h,"ASSET_VIX")]
 ];
 section(root,"Monitor macro contínuo — J14C","Direção do Nasdaq + pressão de juros + dólar + volatilidade. Sem reutilizar cotações atrasadas.",
 "Confluência "+fmtDate(b.time));
 grid(root,[
  {label:"Viés NQ",value:b.value,detail:b.reason,clas:statusClass(b.value)},
  {label:"Cobertura recente",value:b.coverage,detail:"Das quatro fontes NQ, ZT, ZN e DXY MT5"},
  {label:"Sigma NQ",value:shortText(b.sigma),detail:"Volatilidade realizada, não VXN nem DP de opções."},
  {label:"Política monetária",value:z?"ZQ teórico · "+(String(z.month_first).slice(5,7))+"/"+String(z.month_first).slice(0,4):"Aguardando",
   detail:z?"Manutenção: "+num(z.flat,3)+"; -0,25 p.p.: "+num(z.cut25,3)+"; +0,25 p.p.: "+num(z.hike25,3):
   "Taxa oficial e cenários pendentes"}
 ]);
 const list=elt("div","rd-orch__list");
 for(const [name,item] of rows){
  const t=elt("div","rd-orch__line");
  const left=elt("div");
  left.append(elt("div","rd-orch__line-title",name),elt("div","rd-orch__mini",labelAsset(item)));
  const right=elt("div","rd-orch__line-content",meter(item));
  t.append(left,right);list.append(t);
 }
 root.append(list);
 note(root,"ZQ sintético = estimativa baseada na EFFR diária e hipóteses de FOMC; ZQ negociado = expectativa de mercado apenas se atualizado. "+
  "VXN é a volatilidade implícita do NDX; a consulta atrasada não vira VXN LIVE. O VIX é secundário. Nenhum desses indicadores auxiliares altera o viés J14C.");
 external(root,[
  {text:"Radar detalhado J14C ↗",href:"./j14c.html"},
  {text:"VXN oficial diário / FRED ↗",href:"https://fred.stlouisfed.org/series/VXNCLS"}]);
}
function showNasdaq(D){
 const root=$("rdUnifiedNasdaq");if(!root)return;
 const b=viewBias(D.bias),c=D.bias?.context||{};
 const nq=get(D.health,"ASSET_NQ"), dxy=get(D.health,"ASSET_DXY_MT5_SHADOW");
 section(root,"Operacional contextual · Nasdaq","Preços e confluência são observações; os gatilhos de entrada e gestão permanecem exclusivamente no Laranjinha.",
 "Atualizado "+fmtDate(b.time));
 grid(root,[
  {label:"Viés contextual",value:b.value,detail:b.reason,clas:statusClass(b.value)},
  {label:"Confluência macro 15 min",value:(c.bullish_macro_factors??"—")+" altistas · "+(c.bearish_macro_factors??"—")+" baixistas",
   detail:"É contagem de fatores, não probabilidade."},
  {label:"Sigma realizada",value:shortText(b.sigma),detail:"15/60 minutos, exige candles NQ consecutivos."},
  {label:"Integridade NQ / DXY",value:labelAsset(nq)+" / "+labelAsset(dxy),
   detail:"Não inferir direção a partir de um estado neutro por dados insuficientes."}
 ]);
 note(root,"Estado atual "+(b.qualified?"é uma leitura contextual de pesquisa validada para fontes do J14C.":
  "NÃO permite inferir tendência: pelo menos uma condição de dados ou sigma não passou.")+
  " O painel de opções (PR, DP, GF, CW, PW) está separado; não integra automaticamente o score.");
 external(root,[{text:"Auditoria detalhada do radar ↗",href:"./j14c.html"}]);
}
function showEvents(D){
 const root=$("rdUnifiedEvent");if(!root)return;
 const items=D.official?.events||[],latest=items[0],p=D.progress;
 section(root,"Eventos oficiais · cobertura J13 × LIVE","O calendário e os coletores oficiais são distintos do motor de execução de eventos GEN1/GEN2.",
 "Captura "+fmtDate(latest?.first_observed_at_utc));
 grid(root,[
  {label:"Eventos programados J13",value:num(p?.calendar_j13_events),detail:"Calendário: horários, não resultados."},
  {label:"Resultados oficiais apresentados",value:num(p?.official_release_display_rows),
   detail:"Somente valores coletados do documento."},
  {label:"BLS API · versões armazenadas",value:num(p?.bls_extended_versions),detail:"Níveis e revisões; não primeira publicação comprovada."},
  {label:"Outras fontes",value:num(p?.census_verified_dimension_rows)+" Census · "+num(p?.bea_metric_candidates)+" BEA",
   detail:"Pesquisa isolada; nem todas as séries são release LIVE."}
 ]);
 if(latest){
  note(root,latest.event_name+" ("+latest.reference_period+"): "+
   num(latest.actual_num,1)+" "+latest.actual_unit+" no comunicado oficial. Captura em "+
   fmtDate(latest.first_observed_at_utc)+" (+"+num(latest.first_observed_delay_minutes,1)+
   " min). Consenso e surpresa "+(latest.consensus_num===null?"não validados.":"registrados.")+
   " "+(latest.in_live_event_state?"Há evento correspondente no LIVE.":"Sem registro correspondente no motor de eventos LIVE.")+
   " Não atribuir a reação do NQ a esse indicador isoladamente.");
 }else note(root,"Sem valor oficial J13 disponível no momento; não apresentar um resultado inexistente.","alert");
 external(root,[{text:"Publicações oficiais capturadas ↗",href:"https://www.bls.gov/news.release/"}]);
}
function showArchive(D){
 const root=$("rdUnifiedArchive");if(!root)return;
 const p=D.progress,m=D.manifest;
 const manifestVerified=m&&p?.clean_v8_records===m.rows&&p?.clean_v8_distinct_minutes===m.unique_minutes;
 section(root,"Biblioteca macro · CLEAN V8","A biblioteca já está nesta aba: use o filtro por ano, o campo de pesquisa e a paginação abaixo.",
 "Verificação "+fmtDate(p?.assessed_at_utc));
 grid(root,[
  {label:"Eventos disponíveis",value:num(p?.clean_v8_records),detail:"MAIN 2018–2025 e SHADOW 2026 separados no histórico."},
  {label:"Minutos distintos",value:num(p?.clean_v8_distinct_minutes),detail:"Diversos indicadores podem compartilhar o mesmo minuto."},
  {label:"Arquivos por ano",value:m?Object.keys(m.years).length:"—",
   detail:manifestVerified?"Manifesto e contagens no Supabase concordam":"Validação de integridade indisponível"},
  {label:"Uso operacional",value:"NÃO APROVADO",detail:"Forecast vintage e backtest prospectivo ainda não certificados.",
   clas:"rd-orch__warning"}
 ]);
 note(root,"Os "+(manifestVerified?"10.290 eventos são consultáveis no site e têm contagens compatíveis com o Supabase.":
  "registros existem no banco, mas a integridade do manifesto local ainda não foi confirmada.")+
  " Este acervo NÃO alimenta automaticamente GEN1/GEN2, ordens ou otimização operacional.");
}
function track(root,label,status,detail){
 const el=elt("div","rd-orch__track rd-orch__track--"+status);
 el.append(elt("strong",null,label),elt("span",null,detail));
 root.append(el);
}
function showProgress(D){
 const root=$("rdUnifiedProject");if(!root)return;const p=D.progress;
 section(root,"Andamento real do Risk Desk · quadro de entregas",
  "Contadores vêm do Supabase, não são porcentagem fictícia de conclusão. Atualizados automaticamente.",
  "Snapshot "+fmtDate(p?.assessed_at_utc));
 grid(root,[
  {label:"CLEAN V8",value:num(p?.clean_v8_records)+" eventos",detail:num(p?.clean_v8_distinct_minutes)+" minutos separados"},
  {label:"Calendário J13",value:num(p?.calendar_j13_events)+" eventos",detail:"Datas de publicação e famílias distintas"},
  {label:"Coletores oficiais",value:num(p?.census_verified_dimension_rows)+" Census · "+num(p?.bea_metric_candidates)+" BEA",
   detail:num(p?.bls_extended_versions)+" versões BLS; validação independente"},
  {label:"Pesquisa J14C / J14G",value:num(p?.j14c_shadow_samples)+" snapshots",detail:num(p?.official_release_display_rows)+" release(s) exibido(s), "+num(p?.health_diagnostic_items)+" diagnósticos"}
 ]);
 const columns=elt("div","rd-orch__list");
 const left=elt("div"),right=elt("div");
 track(left,"Histórico CLEAN V8 · CONSULTÁVEL","ok","Biblioteca navegável, pesquisa por ano e importância, sem reimportação.");
 track(left,"Calendário J13 + BLS/BEA/Census · COLETAS EM PESQUISA","mixed","Cobertura de eventos e observações registrada; prova AS-OF por evento ainda parcial.");
 track(left,"Radar contínuo NQ · MONITORADO","mixed","NQ, ZT, ZN, DXY MT5 e sigma; validade muda conforme atualização dos dados.");
 track(left,"ZQ teórico · DISPONÍVEL COMO CONTEXTO","mixed",num(p?.zq_theoretical_months)+" meses de cenários EFFR, não negociação CME.");
 track(right,"PPI / notícias · VISÍVEIS NO SITE","mixed","Captura oficial pós-divulgação. Ainda sem integração prospectiva PPI ao motor LIVE.");
 track(right,"VXN / VIX · FONTE PENDENTE","pending","VXN oficial diário de referência; intradiário estável não comprovado. VIX é opcional.");
 track(right,"Dados de opções · AINDA SEM SNAPSHOTS","pending",num(p?.options_snapshots)+" registros no coletor; nenhuma wall/gamma presumida.");
 track(right,"GEN1/GEN2 e PowerShell · VALIDAÇÃO PENDENTE","pending","Modelos preservados; PowerShell local ainda requer teste de autoinício e alimentação real.");
 columns.append(left,right);root.append(columns);
 note(root,"Conclusão do projeto não é igual a cobertura de tabelas. Não há certificação desta camada para probabilidade de lucro, "+
   "execução automatizada ou backtest operacional. A documentação e os resultados são mantidos separados da lógica do robô.");
 external(root,[{text:"Detalhes J14A ↗",href:"./j14a.html"},{text:"Radar J14C ↗",href:"./j14c.html"}]);
}
function missing(root,title){
 if(!root)return;
 section(root,title,"Aguardando dados confirmados do Supabase.");
 note(root,"Fonte indisponível ou sem atualização; nenhum estado foi inventado.","alert");
}
let busy=false;
async function update(){
 if(busy||document.visibilityState==="hidden")return;
 busy=true;
 try{
 const [h,b,z,o,p,m]=await Promise.allSettled([
  fetchJson(URLS.health),fetchJson(URLS.bias),fetchJson(URLS.zq),
  fetchJson(URLS.official),fetchProgress(),fetchManifest()
 ]);
 const data={
  health:h.status==="fulfilled"&&Array.isArray(h.value?.rows)?h.value:null,
  bias:b.status==="fulfilled"&&b.value?.context?b.value:null,
  zq:z.status==="fulfilled"&&Array.isArray(z.value?.rows)?z.value:null,
  official:o.status==="fulfilled"&&Array.isArray(o.value?.events)?o.value:null,
  progress:p.status==="fulfilled"?p.value:null,
  manifest:m.status==="fulfilled"?m.value:null
 };
 if(data.health&&data.bias)showPulse(data);else missing($("rdUnifiedPulse"),"Radar contínuo · aguarde fontes LIVE");
 if(data.health&&data.bias)showMacro(data);else missing($("rdUnifiedMacro"),"Leitura macro · dados indisponíveis");
 if(data.health&&data.bias)showNasdaq(data);else missing($("rdUnifiedNasdaq"),"Nasdaq · confluência indisponível");
 if(data.progress)showEvents(data);else missing($("rdUnifiedEvent"),"Cobertura de eventos J13");
 if(data.progress)showArchive(data);else missing($("rdUnifiedArchive"),"Biblioteca macro CLEAN V8");
 if(data.progress)showProgress(data);else missing($("rdUnifiedProject"),"Progresso do Risk Desk");
 }finally{busy=false;}
}
function start(){if(!IDS.some(id=>$(id)))return;update();setInterval(update,120000);
 const refresh=$("refresh");if(refresh)refresh.addEventListener("click",()=>{update()});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);
else start();
})();