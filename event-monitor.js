/* Risk Desk V10: monitoração somente leitura. Não produz cálculo macro, sinais nem previsões. */
(function () {
  "use strict";
  var el = function (id) { return document.getElementById(id); };
  var escText = function (x) { return esc(x == null ? "—" : x); };
  var seq = 0;
  var liveRows = null, quotes = [], issue = "";
  var tab = "event", automatic = true, currentPhase = null, lastPhaseKey = null;
  var thresholds = {NQ:3, ZN:3, ZT:5, ZQ:10, DXY:5, VIX:5, VXN:5};
  var core = window.RiskDeskCrossAsset;
  var sourceMap = {NQ:"NQ", US2Y:"ZT", US10Y:"ZN", ZQ:"ZQ", DXY:"DXY"};
  function minutes(d) {
    var t = d ? new Date(d).getTime() : NaN;
    return Number.isFinite(t) ? Math.max(0,(Date.now()-t)/60000) : null;
  }
  function n(v, digits) {
    return v == null || !Number.isFinite(Number(v)) ? "—" :
      (Number(v) > 0 ? "+" : "") + Number(v).toFixed(digits == null ? 4 : digits);
  }
  function quote(asset) { return quotes.find(function (q) { return q.asset === asset; }) || null; }
  function assetHealth(asset) {
    var q=quote(asset);
    var h=core.quality(asset,q,Date.now());
    var age=h.age===null?"—":Math.max(0,h.age).toFixed(1)+" min";
    var labels={FRESH:"FRESH",SPARSE:"SPARSE · sem novo negócio",DELAYED:"DELAYED",
      OFF_SESSION:"OFF SESSION",UNAVAILABLE:"INDISPONÍVEL"};
    return {good:h.canConfirm,state:h.state,age:h.age,
      text:(labels[h.state]||"INDISPONÍVEL")+" · "+age+
      (q&&q.source?" · "+q.source:""),source:h.source};
  }
  function condition(name) {
    return '<span class="rv-tag">' + escText(name) + '</span>';
  }
  function renderMarketNow() {
    var box=el("rdMarketNow");
    if(!box)return;
    if(issue){box.innerHTML='<p class="muted">Consulta LIVE indisponível: '+escText(issue)+'</p>';return;}
    if(!Array.isArray(liveRows)){box.innerHTML='<p class="muted">Consultando matriz LIVE...</p>';return;}
    var rows=liveRows.filter(function(r){return r.layer_key!=="EVENT";});
    if(!rows.length){box.innerHTML='<p class="muted">Sem matriz LIVE publicada.</p>';return;}
    var assessed=rows.map(function(r) {
      var a=core.classifyLayer(r,quotes,Date.now());
      return Object.assign({layer_key:r.layer_key},a);
    });
    var pre=core.preSummary(assessed);
    var graph=rows.map(function(r,k){
      var v=assessed[k];
      var active=v.state==="OBSERVED";
      var q= v.asset?assetHealth(v.asset):{text:"Sem origem verificável"};
      var point=active?(v.direction==="UP"?"rv-up":v.direction==="DOWN"?"rv-down":"rv-flat"):"";
      var label=active?(v.direction==="UP"?"ALTA":v.direction==="DOWN"?"BAIXA":"ESTÁVEL"):"SEM VOTO LIVE";
      if(r.layer_key==="US2Y"||r.layer_key==="US10Y"){
        if(active&&v.direction!=="NEUTRAL")label+=v.direction==="DOWN"?" · YIELD ↑ (proxy)":" · YIELD ↓ (proxy)";
      }else if(r.layer_key==="ZQ"&&active&&v.direction!=="NEUTRAL"){
        label+=v.direction==="DOWN"?" · TAXA IMPLÍCITA ↑":" · TAXA IMPLÍCITA ↓";
      }
      return '<div class="rv-line"><div class="rv-name"><b>'+escText(r.label||r.layer_key)+'</b>'+
        '<small>'+escText(q.text)+'</small></div><div class="rv-track"><span class="rv-zero"></span>'+
        (point?'<i class="rv-dot '+point+'"></i>':'')+'</div>'+
        '<div class="rv-reading">'+(active?escText(n(v.raw,4)+(r.value_unit==="PCT"?"%":"")):"—")+
        '<small>'+escText(label)+'</small></div></div>';
    }).join("");
    box.innerHTML='<div class="rv-top"><span>Movimentos observados · janela LIVE</span>'+
      condition("CONTEXTO / NÃO OPERACIONAL")+'</div>'+
      '<div class="rv-preview"><b>'+escText(pre.label)+'</b><span>'+
      pre.usable+' fonte(s) direcionais elegíveis · padrão descritivo, não previsão de CPI ou sugestão de operação</span></div>'+
      '<div class="rv-axis"><span>BAIXA</span><span>ESTÁVEL</span><span>ALTA</span></div>'+graph+
      '<p class="rd-footnote">FRESH é obrigatório para marcador. SPARSE (ZQ), DELAYED, OFF SESSION e UNAVAILABLE não confirmam LIVE. A seta de yield é apenas a orientação inversa do preço ZT/ZN, não um cálculo direto de taxa. A posição dos pontos ilustra a direção, não magnitude, probabilidade ou retorno. Só fonte e janela realmente verificadas participam.</p>';
  }
  function switchGraph(next) {
    tab=next;
    var event=el("rdEventMap"),market=el("rdMarketNow");
    if(event)event.classList.toggle("hidden",tab!=="event");
    if(market)market.classList.toggle("hidden",tab!=="live");
    ["event","live"].forEach(function(t){
      var b=el("rdTab-"+t);
      if(b){b.setAttribute("aria-pressed",String(tab===t&&!automatic));b.classList.toggle("rv-selected",tab===t);}
    });
    var ab=el("rdTab-auto");
    if(ab){ab.setAttribute("aria-pressed",String(automatic));ab.classList.toggle("rv-selected",automatic);}
    if(tab==="live")renderMarketNow();
  }
  function updateMode(data){
    var e=(data.current||[])[0]||(data.next||[])[0]||null;
    var sem=(data.semantic||[])[0]||null;
    var mode=core.eventState(e,sem,data.windows||[],Date.now());
    var phaseKey=(e?e.event_id:"NONE")+":"+mode.mode;
    currentPhase=mode;
    var status=el("rdModeSummary");
    if(status)status.innerHTML='<div class="rv-top"><b>'+escText(mode.label)+'</b>'+
      condition("LEITURA DESCRITIVA")+'</div><div class="rv-mode-desc">'+escText(mode.why)+
      ' · A confirmação pós-evento exige uma janela POST observada; o horário do release, sozinho, não basta.</div>';
    var gate=el("rdEventEvidenceGate");
    if(gate)gate.textContent=mode.mode==="POST_CONFIRMATION"?
      "Evidências pós-evento presentes. Verifique fonte, janela e freshness de cada linha antes de interpretar o alinhamento.":
      "Mapa do evento: aguardando evidências direcionais pós-release; leituras LIVE antes do CPI não confirmam a surpresa.";
    if(automatic&&(lastPhaseKey!==phaseKey||tab!==mode.tab))switchGraph(mode.tab);
    lastPhaseKey=phaseKey;
  }
  var stages=[
    ["PRE60",-60],["RELEASE",0],["POST1",1],
    ["POST5",5],["POST15",15],["POST30",30],["POST60",60]
  ];
  function kind(text,klass,detail){return {text:text,klass:klass,detail:detail};}
  function liveEvent(e,data) {
    if(!e)return null;
    var t0=new Date(e.scheduled_ts_utc).getTime();
    if(!Number.isFinite(t0))return null;
    var release=Number.isFinite(Number(e.actual)) && e.actual!==null &&
      !!e.available_at && !!e.actual_source && e.source_status!=="SCHEDULED";
    var official=release && !!e.consensus_source && e.consensus!=null &&
      e.official_surprise!=null;
    var sem=data.semantic && data.semantic.event_id===e.event_id &&
      data.semantic.mapping_complete===true && data.semantic.prospective_fresh===true && !!data.semantic.updated_at && new Date(data.semantic.updated_at).getTime()>=t0;
    var g1=(data.gen1||[]).find(function(g) {
      return g.event_id===e.event_id && g.mode==="POST_5M" && !/(ERROR|WAITING|WARMUP|INSUFFICIENT|STALE)/i.test(g.service_state||"") && !!g.source_updated_at && new Date(g.source_updated_at).getTime()>=t0+5*60000;
    })||null;
    var g2=data.gen2 && data.gen2.event_id===e.event_id &&
      data.gen2.prospective_fresh===true && data.gen2.feature_schema_complete===true &&
      data.gen2.shadow_only===true && data.gen2.p_up_isotonic!=null && /POST.?5/i.test(data.gen2.stage||"") && !!data.gen2.prediction_ts_utc && new Date(data.gen2.prediction_ts_utc).getTime()>=t0+5*60000 ?data.gen2:null;
    function state(stage,offset) {
      var due=t0+offset*60000;
      if(Date.now()<due) return kind("Futuro","rv-muted","Aguardando horário da etapa");
      if(stage==="PRE60")return kind("Janela iniciada","rv-neutral","Abertura prevista 60 min antes; não comprova processamento");
      if(!release)return kind("Bloqueado","rv-warn","Sem actual oficial com available_at");
      if(stage==="RELEASE")return official?kind("Divulgação registrada","rv-good","Actual, consenso e surpresa publicados"):
        kind("Parcial","rv-warn","Actual recebido; sem consenso/surpresa validada");
      if(!official)return kind("Bloqueado","rv-warn","Surpresa/consenso não validados");
      if(stage==="POST1")return kind("Sem verificação","rv-warn","Não há resultado POST1 auditado nesta camada");
      if(stage==="POST5"){
        if(!sem)return kind("Aguardando J11","rv-warn","Semântica prospectiva ainda não validada");
        if(!g1||!g2)return kind("Aguardando GEN1/GEN2","rv-warn","Sem outputs POST5 prospectivos completos");
        return kind("Evidência publicada","rv-good","GEN1 POST_5M e GEN2 SHADOW prospectivo presentes");
      }
      return kind("Sem auditoria","rv-warn","Falta output observado e auditável da janela +"+offset+"m (range previsto não comprova realização)");
    }
    return {e:e,release:release,official:official,sem:!!sem,g1:!!g1,g2:!!g2,rows:stages.map(function(s){
      return {name:s[0],offset:s[1],state:state(s[0],s[1])};
    })};
  }
  function renderPost(data) {
    var current=(data.current||[])[0]||null, next=(data.next||[])[0]||null;
    var e=current || next, model=liveEvent(e,{
      semantic:(data.semantic||[])[0]||null,gen1:data.gen1||[],gen2:(data.gen2||[])[0]||null
    });
    var target=el("rdPostFlow"),technical=el("rdPostDiagnostics");
    if(!model){
      if(target)target.innerHTML='<div class="rd-empty">Sem evento com data válida.</div>';
      if(technical)technical.innerHTML='<div class="rd-empty">Nenhum evento auditável.</div>';
      return;
    }
    var headline='<div class="rv-top"><b>'+escText(e.event_family)+' · '+escText(utc(e.scheduled_ts_utc))+'</b>'+
      condition(model.official?"Release validado":current?"Janela de evento":"Próximo evento")+'</div>';
    var timeline='<div class="rv-stages">'+model.rows.map(function(r){
      return '<div class="rv-stage '+r.state.klass+'"><b>'+r.name+'</b><strong>'+escText(r.state.text)+
      '</strong><small>'+escText(r.state.detail)+'</small></div>';
    }).join("")+'</div>';
    if(target)target.innerHTML=headline+timeline+
      '<p class="rd-footnote">Horários não comprovam outputs. PRE60 indica apenas janela. POST5 requer J11, GEN1 e GEN2 SHADOW prospectivos. POST15/30/60 só serão confirmados com outputs observados e auditáveis, ainda não presentes nesta camada. Sem dados, a etapa não é marcada como concluída.</p>';
    if(technical){
      var health=data.health||[];
      function hb(key){
        var row=health.find(function(x){return x.component===key;});
        if(!row)return "sem heartbeat";
        var age=row.age_minutes;
        return escText(row.status)+" · "+(age==null?"idade desconhecida":Number(age).toFixed(1)+" min");
      }
      technical.innerHTML=headline+'<div class="rv-diagnostics">'+
        '<div>Actual oficial <b>'+escText(model.release?"Recebido":"Não comprovado")+'</b></div>'+
        '<div>Consenso + surpresa <b>'+escText(model.official?"Validados":"Não validados")+'</b></div>'+
        '<div>J11 semântica prospectiva <b>'+escText(model.sem?"Validada":"Sem registro elegível")+'</b></div>'+
        '<div>GEN1 POST5 <b>'+escText(model.g1?"Encontrado":"Sem registro")+'</b></div>'+
        '<div>GEN2 SHADOW prospectivo <b>'+escText(model.g2?"Encontrado":"Sem registro")+'</b></div>'+
        '<div>Heartbeat GEN1_CONTEXT <b>'+hb("GEN1_CONTEXT")+'</b></div>'+
        '<div>Heartbeat GEN2_SHADOW <b>'+hb("GEN2_SHADOW")+'</b></div>'+
        '</div><p class="rd-footnote">Monitoramento somente leitura. Ausência de registro não deve ser preenchida por dados históricos ou probabilidades de lucro.</p>';
    }
  }
  async function refresh(){
    var id=++seq;
    var req=[
      ["market","riskdesk_product_directional_matrix_v1","select=layer_key,label,raw_value,value_unit,observed_direction,alignment,product_status,market_window,detail&order=sort_order.asc"],
      ["quotes","riskdesk_live_latest_quotes_v1","select=asset,ts_utc,quality_status"],
      ["current","riskdesk_product_current_event_v1","select=event_id,event_family,scheduled_ts_utc,source_status,actual,consensus,official_surprise,actual_source,consensus_source,available_at"],
      ["next","riskdesk_product_next_event_v1","select=event_id,event_family,scheduled_ts_utc,source_status,actual,consensus,official_surprise,actual_source,consensus_source,available_at"],
      ["semantic","riskdesk_product_current_semantic_v1","select=event_id,mapping_complete,prospective_fresh,updated_at"],
      ["gen1","riskdesk_product_current_gen1_v1","select=event_id,mode,service_state,source_updated_at,range_15_pts,range_30_pts,range_60_pts"],
      ["gen2","riskdesk_product_current_gen2_shadow_v1","select=event_id,prospective_fresh,feature_schema_complete,shadow_only,p_up_isotonic,stage,prediction_ts_utc"],
      ["health","riskdesk_product_system_health_v1","select=component,status,age_minutes"]
    ];
    var out=await Promise.allSettled(req.map(function(x){return api(x[1],x[2]);}));
    if(id!==seq)return;
    var data={};
    req.forEach(function(x,i){ data[x[0]]=out[i].status==="fulfilled"?out[i].value:[];});
    issue=out[0].status==="rejected"?String(out[0].reason&&out[0].reason.message||out[0].reason):"";
    liveRows=out[0].status==="fulfilled"?data.market:null;
    quotes=out[1].status==="fulfilled"?data.quotes:[];
    renderMarketNow();
    if (out[2].status==="rejected" || out[3].status==="rejected") {
      ["rdPostFlow","rdPostDiagnostics"].forEach(function(key){
        var node=el(key);
        if(node)node.innerHTML='<div class="rd-empty">Não foi possível verificar o evento. Estado pós-evento não determinado.</div>';
      });
    } else {
      renderPost(data);
      var failures=req.filter(function(x,i){return i>=4&&out[i].status==="rejected";})
        .map(function(x){return x[0];});
      if(failures.length) {
        ["rdPostFlow","rdPostDiagnostics"].forEach(function(key) {
          var node=el(key);
          if(node)node.insertAdjacentHTML("afterbegin",
            '<p class="rd-footnote rv-query-warning">Consulta indisponível: '+escText(failures.join(", "))+
            '. Sem confirmação das fases afetadas.</p>');
        });
      }
    }
  }
  el("rdTab-event").addEventListener("click",function(){automatic=false;switchGraph("event");});
  el("rdTab-live").addEventListener("click",function(){automatic=false;switchGraph("live");});
  el("rdTab-auto").addEventListener("click",function(){automatic=true;lastPhaseKey=null;if(currentPhase)switchGraph(currentPhase.tab);});
  el("refresh").addEventListener("click",refresh);
  switchGraph("event");
  refresh();
  setInterval(function(){if(document.visibilityState!=="hidden")refresh();},60000);
})();
