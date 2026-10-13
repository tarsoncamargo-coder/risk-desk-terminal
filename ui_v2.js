/* Risk Desk V1 executive UI overlay.
   Presentation only: no model, threshold, signal, or trading logic changes. */

function uiTokenV2(x){
  const m={
    INDETERMINATE:"INDETERMINADO",HIGH:"ALTA",MODERATE:"MODERADA",LOW:"BAIXA",CONFLICT:"CONFLITO",
    UP:"ALTA",DOWN:"BAIXA",NONE:"SEM DIRECAO",WAITING:"AGUARDANDO",STALE:"DESATUALIZADO",
    UNAVAILABLE:"INDISPONIVEL",CONTEXT_ONLY:"CONTEXTO",SEMANTIC_CONFLICT:"CONFLITO SEMANTICO",
    RISK_CONFLICT:"CONFLITO DE RISCO",DIRECTIONAL_INPUT:"DIRECIONAL",
    TRANSITION_OR_INSUFFICIENT:"TRANSICAO / DADOS INSUFICIENTES",
    INSUFFICIENT:"INSUFICIENTE",PARTIAL:"PARCIAL",CONFIRMED:"CONFIRMADO",
    FULL:"COMPLETA",MINIMAL:"MINIMA",SCHEDULED:"AGENDADO",WARMUP:"AQUECIMENTO",
    STOPPED:"PARADO",ERROR:"ERRO",OK:"OK"
  };
  return m[x]||x||"—";
}

function renderDeskMode(){
  const el=$("deskMode");
  if(!el)return;
  const cur=S.productCurrent,nxt=S.productNext,c=S.productConfluence;
  let title="MODO PRE-EVENTO",detail="Aguardando janela ativa do proximo evento.",cls="desk-wait";
  if(cur){
    title="EVENTO EM ACOMPANHAMENTO";
    detail=esc(cur.event_family||"Evento")+" · "+uiTokenV2(cur.lifecycle);
    cls="desk-live";
  }else if(nxt){
    const mins=Math.max(0,Math.round(Number(nxt.minutes_to_event||0)));
    const h=Math.floor(mins/60),m=mins%60;
    detail=esc(nxt.event_family||"Evento")+" em "+(h?h+"h ":"")+m+"min";
  }
  const conf=c?uiTokenV2(c.confluence_level):"INDETERMINADO";
  el.innerHTML='<div><span class="desk-label '+cls+'">'+title+'</span><b>'+detail+'</b></div>'+
    '<div class="desk-meta">Confluencia: '+conf+' · Operacional: NAO AUTORIZADO</div>';
}

function confluenceHtml(c){
  if(!c)return'<div class="mv muted" style="font-size:17px">INDETERMINADO</div><div class="ms">Aguardando camadas validas.</div>';
  const l=c.confluence_level||"INDETERMINATE",d=c.direction||"NONE";
  const cls=l==="HIGH"?(d==="UP"?"pos":d==="DOWN"?"neg":""):l==="CONFLICT"?"neg":l==="MODERATE"||l==="LOW"?"warn":"";
  return '<div class="mv '+cls+'">'+esc(uiTokenV2(l))+(d!=="NONE"?' · '+esc(uiTokenV2(d)):'')+'</div>'+
    '<div class="ms">Cobertura '+esc(uiTokenV2(c.evidence_coverage||"NONE"))+' · '+esc(c.directional_layers_available==null?0:c.directional_layers_available)+'/3 camadas direcionais</div>'+
    '<div class="layer-grid gap-top">'+
      '<span>Market</span><b>'+esc(uiTokenV2(c.market_direction||"UNAVAILABLE"))+'</b>'+
      '<span>Playbook</span><b>'+esc(uiTokenV2(c.playbook_direction||"UNAVAILABLE"))+'</b>'+
      '<span>GEN2</span><b>'+esc(uiTokenV2(c.gen2_direction||"UNAVAILABLE"))+'</b>'+
      '<span>Evento</span><b>'+esc(uiTokenV2(c.event_alignment||"UNAVAILABLE"))+'</b>'+
      '<span>GEN1</span><b>'+esc(uiTokenV2(c.gen1_alignment||"UNAVAILABLE"))+'</b>'+
    '</div><div class="ms">Cross-asset ja esta dentro do Market State e nao e contado duas vezes. Sem score ponderado.</div>';
}

function marketV2Html(){
  const a=S.productMarketV2||[];
  let r=null;
  if(S.productCurrent){
    r=a.find(x=>x.window==="LIVE"&&x.product_status==="LEITURA_DISPONIVEL")||
      a.find(x=>x.product_status==="LEITURA_DISPONIVEL")||a.find(x=>x.window==="LIVE")||a[0];
  }else{
    r=a.find(x=>x.window==="PRE60")||a.find(x=>x.window==="PRE30")||a[0];
  }
  if(!r)return'<div class="mv muted" style="font-size:17px">Sem leitura live</div><div class="ms">Aguardando janela do evento.</div>';
  const st=r.market_state_v2||"UNAVAILABLE";
  const cls=st==="RISK_ON"?"pos":st==="RISK_OFF"?"neg":["MIXED","STALE","WAITING"].includes(st)?"warn":"";
  return '<div class="mv '+cls+'">'+esc(uiTokenV2(st))+'</div>'+
    '<div class="ms">'+esc(r.window)+' · '+esc(uiTokenV2(r.product_status||"—"))+'</div>'+
    '<div class="kv mini-kv gap-top"><div>NQ</div><div>'+sign(r.nq_raw_pct,4)+'</div><div>DXY</div><div>'+sign(r.dxy_raw_pct,4)+'</div>'+
    '<div>2Y</div><div>'+esc(uiTokenV2(r.rates_2y_reading||"UNAVAILABLE"))+'</div><div>Risco</div><div>'+esc(uiTokenV2(r.risk_reading||"UNAVAILABLE"))+'</div></div>';
}

function playbookHtml(){
  const p=S.productPlaybook;
  if(!p)return'<div class="mv muted" style="font-size:17px">Indisponivel</div>';
  const code=p.playbook_code||"TRANSITION_OR_INSUFFICIENT";
  const cls=code==="GOLDILOCKS"||code==="REFLATION"?"pos":code==="STAGFLATION"||code==="DISINFLATIONARY_RISK_OFF"?"neg":"warn";
  return '<div class="mv '+cls+'">'+esc(uiTokenV2(code))+'</div>'+
    '<div class="ms">'+esc(uiTokenV2(p.playbook_status||"—"))+' · '+(p.carry_forward?"carry-forward validado":"live")+'</div>'+
    '<div class="kv mini-kv gap-top"><div>Growth</div><div>'+sign(p.growth_score,3)+'</div><div>Inflation</div><div>'+sign(p.inflation_score,3)+'</div></div>';
}

function renderPlaybookV1(){
  const p=S.productPlaybook;
  if(!p){$("playbookToday").innerHTML='<div class="mv muted" style="font-size:17px">Playbook indisponivel</div><div class="ms">Aguardando contexto macro validado.</div>';return}
  const code=p.playbook_code||"TRANSITION_OR_INSUFFICIENT";
  const cls=code==="GOLDILOCKS"||code==="REFLATION"?"pos":code==="STAGFLATION"||code==="DISINFLATIONARY_RISK_OFF"?"neg":"warn";
  $("playbookToday").innerHTML='<div class="mv '+cls+'">'+esc(uiTokenV2(code))+'</div>'+
    '<div class="ms">Estado: '+esc(uiTokenV2(p.playbook_status||"—"))+' · '+(p.carry_forward?"carry-forward validado":"live")+'</div>'+
    '<div class="kv mini-kv gap-top"><div>Growth</div><div>'+sign(p.growth_score,3)+' <span class="micro">'+esc(p.growth_status||"—")+'</span></div>'+
    '<div>Inflation</div><div>'+sign(p.inflation_score,3)+' <span class="micro">'+esc(p.inflation_status||"—")+'</span></div>'+
    '<div>Freshness</div><div>'+esc(p.freshness_days==null?"—":p.freshness_days+" dias")+'</div>'+
    '<div>Inputs live</div><div>'+(p.live_inputs_complete?"COMPLETOS":"INCOMPLETOS")+'</div></div>'+
    '<div class="ms">Regime estrutural. Nao muda por um unico evento e nao autoriza operacao.</div>';
}

function renderMarketV2(){
  const a=S.productMarketV2||[];
  let r=null;
  if(S.productCurrent){
    r=a.find(x=>x.window==="LIVE"&&x.product_status==="LEITURA_DISPONIVEL")||
      a.find(x=>x.product_status==="LEITURA_DISPONIVEL")||a.find(x=>x.window==="LIVE")||a[0];
  }else{
    r=a.find(x=>x.window==="PRE60")||a.find(x=>x.window==="PRE30")||a[0];
  }
  if(!r){
    $("marketV2Today").innerHTML='<div class="mv muted" style="font-size:17px">Sem Market State V2 disponivel</div><div class="ms">Aguardando contexto live do proximo evento.</div>';
    $("dossierMarketV2").innerHTML='<tr><td colspan="9" class="muted">Sem leituras V2.</td></tr>';
    return;
  }
  const state=r.market_state_v2||"UNAVAILABLE";
  const cls=state==="RISK_ON"?"pos":state==="RISK_OFF"?"neg":["MIXED","STALE","WAITING"].includes(state)?"warn":"";
  $("marketV2Today").innerHTML='<div class="mv '+cls+'">'+esc(uiTokenV2(state))+'</div>'+
    '<div class="ms">'+esc(r.window)+' · '+esc(uiTokenV2(r.product_status||"—"))+' · '+esc(r.event_role||"—")+'</div>'+
    '<div class="kv market-kv gap-top"><div>NQ</div><div>'+sign(r.nq_raw_pct,4)+'</div><div>DXY</div><div>'+sign(r.dxy_raw_pct,4)+'</div>'+
    '<div>2Y</div><div>'+esc(uiTokenV2(r.rates_2y_reading||"UNAVAILABLE"))+'</div><div>10Y</div><div>'+esc(uiTokenV2(r.rates_10y_reading||"UNAVAILABLE"))+'</div>'+
    '<div>Risco</div><div>'+esc(uiTokenV2(r.risk_reading||"UNAVAILABLE"))+'</div><div>Sigma</div><div>'+esc(uiTokenV2(r.sigma_reading||"UNAVAILABLE"))+'</div></div>'+
    '<div class="ms">Alinhamento com a semantica do evento: INDETERMINADO. Nenhum score novo foi criado.</div>';
  const order={LIVE:0,PRE5:1,PRE15:2,PRE30:3,PRE60:4,PRE240:5,PRE1440:6};
  const rows=[...a].sort((x,y)=>(order[x.window]??99)-(order[y.window]??99));
  $("dossierMarketV2").innerHTML=rows.length?rows.map(x=>{
    const st=x.market_state_v2||"UNAVAILABLE";
    const tc=st==="RISK_ON"?"pos":st==="RISK_OFF"?"neg":["WAITING","STALE","MIXED"].includes(st)?"warn":"";
    return '<tr><td><b>'+esc(x.window)+'</b></td><td class="'+tc+'">'+esc(uiTokenV2(st))+'</td><td>'+sign(x.nq_raw_pct,4)+'</td><td>'+sign(x.dxy_raw_pct,4)+'</td>'+
      '<td>'+esc(uiTokenV2(x.rates_2y_reading||"UNAVAILABLE"))+'</td><td>'+esc(uiTokenV2(x.rates_10y_reading||"UNAVAILABLE"))+'</td>'+
      '<td>'+esc(uiTokenV2(x.risk_reading||"UNAVAILABLE"))+'</td><td>'+esc(uiTokenV2(x.sigma_reading||"UNAVAILABLE"))+'</td><td>'+esc(uiTokenV2(x.product_status||"—"))+'</td></tr>';
  }).join(""):'<tr><td colspan="9" class="muted">Sem leituras V2.</td></tr>';
}


function alignmentLabel(x){
  const m={ALIGNED:"A FAVOR",CONTRARY:"CONTRA",NEUTRAL:"NEUTRO",BASE:"BASE",WAITING:"AGUARDANDO",WAITING_EVENT_SEMANTIC:"AGUARDANDO EVENTO",WAITING_MARKET_DATA:"AGUARDANDO MERCADO",UNAVAILABLE:"INDISPONIVEL"};
  return m[x]||x||"—";
}
function alignmentClass(x){
  if(x==="ALIGNED")return"cf-good";
  if(x==="CONTRARY")return"cf-bad";
  if(x==="NEUTRAL"||x==="BASE")return"cf-neutral";
  return"cf-wait";
}
function alignmentPos(x){
  if(x==="ALIGNED")return 88;
  if(x==="CONTRARY")return 12;
  return 50;
}
function directionalValue(r){
  if(!r)return"—";
  if(r.layer_key==="EVENT")return uiTokenV2(r.observed_direction||"AGUARDANDO");
  if(r.value_unit==="SIGMA_Z")return r.raw_value==null?uiTokenV2(r.observed_direction||"UNAVAILABLE"):sign(r.raw_value,2)+" z";
  return r.raw_value==null?uiTokenV2(r.observed_direction||"UNAVAILABLE"):sign(r.raw_value,4)+"%";
}
function renderDirectionalGraph(){
  const el=$("directionalGraph"),rel=$("relatedEvents");
  if(!el||!rel)return;
  const rows=S.productDirectional||[];
  if(!rows.length){
    el.innerHTML='<div class="muted">Aguardando matriz de confluencia.</div>';
    rel.innerHTML="";
    return;
  }
  const counted=rows.filter(r=>["ALIGNED","CONTRARY","NEUTRAL"].includes(r.alignment));
  const fav=counted.filter(r=>r.alignment==="ALIGNED").length;
  const contra=counted.filter(r=>r.alignment==="CONTRARY").length;
  const neutro=counted.filter(r=>r.alignment==="NEUTRAL").length;
  el.innerHTML=
    '<div class="cf-summary"><span><b>'+fav+'</b> a favor</span><span><b>'+contra+'</b> contra</span><span><b>'+neutro+'</b> neutro</span><span class="micro">Sem score ponderado</span></div>'+
    '<div class="cf-axis"><span>CONTRA</span><span>NEUTRO</span><span>A FAVOR</span></div>'+
    rows.map(r=>{
      const cls=alignmentClass(r.alignment),pos=alignmentPos(r.alignment);
      return '<div class="cf-row '+cls+'">'+
        '<div class="cf-name"><b>'+esc(r.label||r.layer_key)+'</b><span>'+esc(r.detail||"")+'</span></div>'+
        '<div class="cf-track"><i class="cf-mid"></i><i class="cf-dot" style="left:'+pos+'%"></i></div>'+
        '<div class="cf-value">'+esc(directionalValue(r))+'</div>'+
        '<div class="cf-status">'+esc(alignmentLabel(r.alignment))+'</div>'+
      '</div>';
    }).join("");

  const rr=S.productRelated||[];
  const ready=rr.filter(x=>x.availability_status==="READY");
  const pending=rr.filter(x=>x.availability_status!=="READY");
  const renderRel=x=>{
    const cls=alignmentClass(x.alignment);
    const when=x.related_ts_utc?brt(x.related_ts_utc):"sem release validado";
    const stance=x.related_stance?uiTokenV2(x.related_stance):"SEM LEITURA";
    return '<div class="rel-card '+cls+'"><div><b>'+esc(x.related_family)+'</b><span>'+esc(x.relation_label||"")+'</span></div>'+
      '<div class="rel-meta">'+esc(when)+' · '+esc(stance)+'</div>'+
      '<div class="rel-align">'+esc(alignmentLabel(x.alignment))+'</div></div>';
  };
  rel.innerHTML='<div class="cf-related-title">Eventos macro relacionados</div>'+
    (rr.length?(ready.concat(pending).slice(0,3).map(renderRel).join("")):'<div class="muted">Nenhum relacionamento configurado.</div>')+
    '<div class="ms">A ordem segue relevancia macro predefinida; evidencias contrarias nao sao ocultadas.</div>';
}

function sampleStatusLabel(x){
  const m={VERY_SMALL_EXPLORATORY:"MUITO PEQUENA",INSUFFICIENT:"INSUFICIENTE",MISSING:"SEM DADOS",TRANSITION:"TRANSICAO",OK:"OK"};
  return m[x]||x||"—";
}
function macro(){
  const m=S.macro;
  $("macroLast").innerHTML='<div class="kv"><div>Data</div><div>'+br(m.regime_date)+'</div><div>Dataset</div><div>'+bd(m.dataset_regime)+'</div>'+
    '<div>Growth</div><div class="'+tone(m.growth_score)+'">'+sign(m.growth_score)+'</div><div>Inflation</div><div class="'+tone(m.inflation_score)+'">'+sign(m.inflation_score)+'</div>'+
    '<div>Playbook</div><div>'+esc(pl(m.playbook))+'</div><div>Status</div><div>'+(m.playbook==="TRANSITION_OR_INSUFFICIENT"?'<span class="badge bwarn">TRANSICAO</span>':'<span class="badge bgood">REGIME FORTE</span>')+'</div></div>';
  const p=$("qp");
  if(m.playbook==="TRANSITION_OR_INSUFFICIENT")p.classList.add("hidden");
  else{
    p.style.left=Math.max(5,Math.min(95,50+Number(m.growth_score)*100))+"%";
    p.style.top=Math.max(5,Math.min(95,50-Number(m.inflation_score)*100))+"%";
    p.classList.remove("hidden");
  }
  const total=S.pb.reduce((a,x)=>a+Number(x.n||0),0)||1;
  $("pbd").innerHTML=S.pb.map(x=>{
    const pct=100*Number(x.n||0)/total;
    return '<div class="dr"><div class="dr-main"><b>'+esc(pl(x.playbook))+'</b><div class="bar"><div class="fill" style="width:'+pct.toFixed(1)+'%"></div></div></div>'+
      '<div class="dr-pct">'+x.n+' · '+pct.toFixed(1)+'%</div>'+
      '<div class="dr-status"><span class="badge '+(x.sample_status==="INSUFFICIENT"?"bwarn":"")+'">'+esc(sampleStatusLabel(x.sample_status))+'</span></div></div>';
  }).join("");
  $("macroRows").innerHTML=S.m.slice(0,300).map(x=>'<tr><td>'+br(x.regime_date)+'</td><td class="'+tone(x.growth_score)+'">'+sign(x.growth_score)+'</td>'+
    '<td class="'+tone(x.inflation_score)+'">'+sign(x.inflation_score)+'</td><td>'+esc(pl(x.playbook))+'</td><td>'+bd(x.dataset_regime)+'</td></tr>').join("");
}

function renderLive(){
  const d=S.liveDash||{},rows=S.liveStatus||[],active=Number(d.active_assets||0);
  const hasErr=rows.some(x=>x.status==="ERROR");
  const hasPartial=rows.some(x=>["STALE","WARMUP","WAITING","STOPPED"].includes(x.status));
  const badge=hasErr?'<span class="badge bbad">PIPELINE DEGRADADO</span>':
    hasPartial?'<span class="badge bwarn">PIPELINE PARCIAL</span>':
    '<span class="badge bgood">PIPELINE SAUDAVEL</span>';
  const details=rows.map(x=>'<div class="health-row"><span>'+esc(x.component)+'</span><span class="'+
    (x.status==="OK"?"pos":x.status==="ERROR"?"neg":"warn")+'">'+esc(uiTokenV2(x.status))+'</span></div>').join("");
  $("livePipeline").innerHTML='<div class="pipeline-summary">'+badge+'<span class="micro">'+active+' ativo(s) com quote recente</span></div>'+
    details+'<div class="ms">Estado tecnico; nao altera a governanca operacional.</div>';
}

function render(){
  const e=S.last,m=S.macro;
  if(!e||!m)return;

  renderProductEvents();
  renderProductIntelligence();
  renderMarketV2();
  renderPlaybookV1();
  renderDirectionalGraph();
  renderConfluenceAnalysis();
  renderNasdaqV2();
  renderDossier();
  renderSystem();
  renderDeskMode();

  const days=Math.floor((Date.now()-new Date(e.release_ts_utc).getTime())/86400000);
  const notices=[];
  if(!S.productNext&&days>0)notices.push("Ultimo snapshot historico: <b>"+br(e.release_ts_utc)+"</b>. Nao e leitura live.");
  if(!guardOK())notices.push("<b>Auditoria de integridade:</b> algumas camadas historicas permanecem suspensas. Consulte a aba Sistema.");
  if(notices.length){
    $("notice").classList.remove("hidden");
    $("notice").innerHTML=notices.join("<br><br>");
  }else{
    $("notice").classList.add("hidden");
    $("notice").innerHTML="";
  }

  $("lastEvent").innerHTML='<div class="kv"><div>Release</div><div>'+utc(e.release_ts_utc)+'<br><span class="micro">'+ny(e.release_ts_utc)+'</span></div>'+
    '<div>Dataset</div><div>'+bd(e.dataset_regime)+'</div><div>Headline CPI surprise</div><div class="'+tone(e.headline_cpi_surprise)+'">'+sign(e.headline_cpi_surprise)+'</div>'+
    '<div>Shock</div><div>'+esc(e.shock_reading)+'</div><div>Playbook</div><div>'+esc(e.site_label||pl(e.playbook))+'</div>'+
    '<div>Freshness</div><div>'+days+' dia(s) atras</div><div>Governanca</div><div><span class="badge bwarn">CONTEXT ONLY</span></div></div>';

  $("quality").innerHTML=[...S.q].sort(function(a,b){const ra=a.status==="FAIL"?0:a.status==="UNAVAILABLE"?1:2;const rb=b.status==="FAIL"?0:b.status==="UNAVAILABLE"?1:2;return ra-rb})
    .slice(0,18).map(x=>'<div class="health-row"><span>'+esc(x.source)+' · '+esc(x.metric)+'</span><b class="'+
    (x.status==="OK"?"pos":x.status==="UNAVAILABLE"?"warn":"muted")+'">'+esc(uiTokenV2(x.status))+'</b></div>').join("");

  filters();events();macro();market();history();renderLive();
}

/* Re-render after this presentation overlay loads. */
setTimeout(function(){try{if(S.last&&S.macro)render()}catch(e){console.error("Risk Desk UI V2",e)}},0);
