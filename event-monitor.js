/* Risk Desk V10: monitoração somente leitura. Não produz cálculo macro, sinais nem previsões. */
(function () {
  "use strict";
  var el = function (id) { return document.getElementById(id); };
  var escText = function (x) { return esc(x == null ? "—" : x); };
  var seq = 0;
  var liveRows = null, quotes = [], issue = "";
  var tab = "event";
  var thresholds = {NQ:3, ZN:3, ZT:5, ZQ:10, DXY:15, VIX:15, VXN:15};
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
    var q=quote(asset), age=q?minutes(q.ts_utc):null;
    if(!q||age==null) return {good:false,text:"Sem cotação"};
    if(q.quality_status!=="OK") return {good:false,text:q.quality_status || "Qualidade não validada"};
    if(age>(thresholds[asset]||5)) return {good:false,text:"Defasado: "+age.toFixed(1)+" min"};
    return {good:true,text:"Cotação "+age.toFixed(1)+" min"};
  }
  function condition(name) {
    return '<span class="rv-tag">' + escText(name) + '</span>';
  }
  function renderMarketNow() {
    var box=el("rdMarketNow");
    if(!box) return;
    if(issue) {box.innerHTML='<p class="muted">Consulta LIVE indisponível: '+escText(issue)+'</p>';return;}
    if(!Array.isArray(liveRows)) {box.innerHTML='<p class="muted">Consultando matriz LIVE...</p>';return;}
    var rows=liveRows.filter(function(r){return r.layer_key!=="EVENT";});
    if(!rows.length) {box.innerHTML='<p class="muted">Sem matriz LIVE publicada.</p>';return;}
    var labels={UP:"Alta observada",DOWN:"Baixa observada",NEUTRAL:"Sem variação observada"};
    var graph=rows.map(function(r){
      var vol=r.layer_key==="VOL";
      var a=vol?assetHealth("VIX"):assetHealth(sourceMap[r.layer_key]);
      var b=vol?assetHealth("VXN"):null;
      var good=vol?(a.good&&b.good):a.good;
      var direction=r.observed_direction;
      var active=good&&r.market_window==="LIVE"&&r.product_status==="LEITURA_DISPONIVEL"&&
          ["UP","DOWN","NEUTRAL"].includes(direction) && r.raw_value!=null;
      var point=active?(direction==="UP"?"rv-up":direction==="DOWN"?"rv-down":"rv-flat"):"";
      var status=active?labels[direction]:"Sem leitura LIVE validada";
      var qlabel=vol?a.text+" · "+b.text:a.text;
      var val=active?n(r.raw_value,4)+(r.value_unit==="PCT"?"%":""):"—";
      return '<div class="rv-line"><div class="rv-name"><b>'+escText(r.label||r.layer_key)+'</b>'+
        '<small>'+escText(qlabel)+'</small></div><div class="rv-track"><span class="rv-zero"></span>'+
        (point?'<i class="rv-dot '+point+'"></i>':'')+'</div>'+
        '<div class="rv-reading">'+escText(val)+'<small>'+escText(status)+'</small></div></div>';
    }).join("");
    box.innerHTML='<div class="rv-top"><span>Variação observada nas fontes existentes</span>'+
      condition("CONTEXTO / NÃO OPERACIONAL")+'</div>'+
      '<div class="rv-axis"><span>BAIXA</span><span>ESTÁVEL</span><span>ALTA</span></div>'+graph+
      '<p class="rd-footnote">Marcadores indicam somente UP/DOWN/NEUTRAL publicados pela matriz em janela LIVE e com cotação recente. Não expressam intensidade, alinhamento ao evento ou probabilidade. Dados ausentes e atrasados ficam sem marcador. Proxies ZT/ZN não são yields diretos.</p>';
  }
  function switchGraph(next) {
    tab=next;
    var event=el("rdEventMap"),market=el("rdMarketNow");
    if(event)event.classList.toggle("hidden",tab!=="event");
    if(market)market.classList.toggle("hidden",tab!=="live");
    ["event","live"].forEach(function(t) {
      var b=el("rdTab-"+t);
      if(b){b.setAttribute("aria-pressed",String(tab===t));b.classList.toggle("rv-selected",tab===t);}
    });
    if(tab==="live")renderMarketNow();
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
      data.semantic.mapping_complete===true && data.semantic.prospective_fresh===true;
    var g1=(data.gen1||[]).find(function(g) {
      return g.event_id===e.event_id && g.mode==="POST_5M" && g.service_state!=="ERROR";
    })||null;
    var g2=data.gen2 && data.gen2.event_id===e.event_id &&
      data.gen2.prospective_fresh===true && data.gen2.feature_schema_complete===true &&
      data.gen2.shadow_only===true && data.gen2.p_up_isotonic!=null ?data.gen2:null;
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
      var field={"POST15":"range_15_pts","POST30":"range_30_pts","POST60":"range_60_pts"}[stage];
      var sourceTime=g1&&g1.source_updated_at?new Date(g1.source_updated_at).getTime():NaN;
      if(g1&&g1[field]!=null&&Number.isFinite(sourceTime)&&sourceTime>=due)
        return kind("Evidência publicada","rv-good","Range "+offset+" min com timestamp posterior à janela");
      return kind("Não validado","rv-warn","Aguardando leitura auditável da janela +"+offset+"m");
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
      '<p class="rd-footnote">Horários não comprovam outputs. PRE60 indica apenas janela. POST5 requer J11, GEN1 e GEN2 SHADOW prospectivos. POST15/30/60 exigem range persistido após a janela. Sem dados, a etapa não é marcada como concluída.</p>';
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
      ["semantic","riskdesk_product_current_semantic_v1","select=event_id,mapping_complete,prospective_fresh"],
      ["gen1","riskdesk_product_current_gen1_v1","select=event_id,mode,service_state,source_updated_at,range_15_pts,range_30_pts,range_60_pts"],
      ["gen2","riskdesk_product_current_gen2_shadow_v1","select=event_id,prospective_fresh,feature_schema_complete,shadow_only,p_up_isotonic"],
      ["health","riskdesk_product_system_health_v1","select=component,status,age_minutes"]
    ];
    var out=await Promise.allSettled(req.map(function(x){return api(x[1],x[2]);}));
    if(id!==seq)return;
    var data={};
    req.forEach(function(x,i){ data[x[0]]=out[i].status==="fulfilled"?out[i].value:[];});
    issue=out[0].status==="rejected"?String(out[0].reason&&out[0].reason.message||out[0].reason):"";
    liveRows=out[0].status==="fulfilled"?data.market:null;
    quotes=out[1].status==="fulfilled"?data.quotes:[];
    renderMarketNow();renderPost(data);
  }
  el("rdTab-event").addEventListener("click",function(){switchGraph("event");});
  el("rdTab-live").addEventListener("click",function(){switchGraph("live");});
  el("refresh").addEventListener("click",refresh);
  switchGraph("event");
  refresh();
  setInterval(function(){if(document.visibilityState!=="hidden")refresh();},60000);
})();
