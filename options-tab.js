/* Risk Desk Options Tab V1
   UI only. Manual parsing and collector snapshots stay isolated from the
   macro/model/trading pipeline. */
(function(){
  "use strict";
  const Core=window.RiskDeskOptionsCore;
  if(!Core)return;
  const assets=["MGC","MNQ"];
  const state={current:{MGC:null,MNQ:null},source:{MGC:null,MNQ:null},auto:{MGC:null,MNQ:null}};
  const el=id=>document.getElementById(id);
  const html=x=>String(x==null?"":x).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const cfg=a=>Core.ASSETS[a];
  const fmt=(v,d=2)=>v==null||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
  const fmtPrice=(a,v)=>fmt(v,cfg(a).priceDigits);
  const fmtInt=v=>v==null?"—":Number(v).toLocaleString("pt-BR",{maximumFractionDigits:0});
  const fmtGex=v=>v==null?"—":(Number(v)/1e6).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+" M";
  const tone=v=>Number(v)>0?"pos":Number(v)<0?"neg":"";
  const storageKey=a=>"riskdesk_options_history_v1_"+a;

  function history(a){
    try{return JSON.parse(localStorage.getItem(storageKey(a))||"[]")}catch(_){return[]}
  }
  function saveHistory(a,r){
    const row={...Core.snapshotPayload(r,"MANUAL_LOCAL",new Date().toISOString()),warnings:r.warnings||[]};
    const list=[row,...history(a)].slice(0,20);
    localStorage.setItem(storageKey(a),JSON.stringify(list));
    renderHistory(a);
  }
  function clearHistory(a){
    localStorage.removeItem(storageKey(a));
    renderHistory(a);
  }
  function badge(status){
    const cls=status==="COMPLETO"?"bgood":"bwarn";
    return '<span class="badge '+cls+'">'+html(status||"PARCIAL")+'</span>';
  }
  function resultCards(a,r,sourceLabel){
    const L=r.levels||{};
    const gf=r.gfCTick!=null?r.gfCTick:r.gfC;
    const source=sourceLabel||"MANUAL";
    const warnings=(r.warnings||[]).map(w=>'<div class="opt-warning">'+html(w)+'</div>').join("");
    const quality=r.quality||{};
    const levels=[
      ["DP -3",L.m3?.tick],["DP -2",L.m2?.tick],["DP -1",L.m1?.tick],
      ["PR",r.referencePrice],["DP +1",L.p1?.tick],["DP +2",L.p2?.tick],["DP +3",L.p3?.tick]
    ];
    const regimeCls=r.gammaRegime==="POSITIVO"?"pos":r.gammaRegime==="NEGATIVO"?"neg":"warn";
    return '<div class="opt-cards">'+
      card("PR",fmtPrice(a,r.referencePrice),r.series||"série não identificada")+
      card("ATM",fmtPrice(a,r.atmStrike),"Delta Call "+fmt(r.atmCallDelta,2))+
      card("IV ATM",r.atmIvPct==null?"—":fmt(r.atmIvPct,2)+"%","DTE "+fmt(r.dteDays,2)+" · "+fmt(r.dteMinutes,1)+" min")+
      card("1 DP",fmt(r.dp1,2)+" pts","tick "+fmt(r.dp1Tick,2))+
      card("CW-C",fmtPrice(a,r.cwC),"Call OI "+fmtInt(r.cwCallOi))+
      card("PW-C",fmtPrice(a,r.pwC),"Put OI "+fmtInt(r.pwPutOi))+
      card("GF-C",fmtPrice(a,gf),"Gamma Flip")+
      '<div class="opt-card"><div class="k">Regime Gamma</div><div class="v '+regimeCls+'">'+html(r.gammaRegime||"—")+'</div><div class="s">Net GEX no PR</div></div>'+
      card("Call GEX",fmtGex(r.callGex),"positivo")+
      card("Put GEX",fmtGex(r.putGex),"negativo")+
      '<div class="opt-card"><div class="k">Net GEX</div><div class="v '+tone(r.netGex)+'">'+html(fmtGex(r.netGex))+'</div><div class="s">no preço de referência</div></div>'+
      '<div class="opt-card"><div class="k">Qualidade</div><div class="v" style="font-size:16px">'+badge(r.dataStatus)+'</div><div class="s">'+html(source)+'</div></div>'+
      '</div>'+
      '<div class="opt-levels">'+levels.map(x=>'<div class="opt-level"><span>'+html(x[0])+'</span><b>'+html(fmtPrice(a,x[1]))+'</b></div>').join("")+'</div>'+
      '<div class="opt-warnings">'+(warnings||'<div class="opt-warning opt-good">Parser sem alertas críticos para este snapshot.</div>')+'</div>'+
      '<div class="opt-source">Parser '+html(r.parserVersion||"OPTIONS_V1")+' · Pricing '+fmtInt(quality.pricingRows)+' strikes · OI '+fmtInt(quality.oiRows)+' strikes · GEX '+fmtInt(quality.matchedStrikes)+' strikes coincidentes</div>';
  }
  function card(k,v,s){
    return '<div class="opt-card"><div class="k">'+html(k)+'</div><div class="v">'+html(v)+'</div><div class="s">'+html(s||"")+'</div></div>';
  }
  function renderResult(a,r,sourceLabel){
    const box=el("optResults"+a);
    if(!box)return;
    if(!r){box.innerHTML='<div class="muted">Cole os dados do QuickStrike e clique em Processar.</div>';return}
    box.innerHTML=resultCards(a,r,sourceLabel);
  }
  function renderHistory(a){
    const box=el("optHistory"+a);
    if(!box)return;
    const list=history(a);
    if(!list.length){box.innerHTML='<div class="muted">Nenhuma coleta manual salva neste navegador.</div>';return}
    box.innerHTML=list.slice(0,10).map(r=>{
      const when=new Date(r.collected_at).toLocaleString("pt-BR");
      return '<div class="opt-history-row"><span>'+html(when)+'</span><b>PR '+html(fmtPrice(a,r.reference_price))+'</b><b>CW '+html(fmtPrice(a,r.cw_c))+'</b><b>GF '+html(fmtPrice(a,r.gf_c))+'</b><b>PW '+html(fmtPrice(a,r.pw_c))+'</b></div>';
    }).join("");
  }
  function process(a){
    const input=el("optInput"+a),status=el("optStatus"+a);
    const text=input?.value||"";
    if(!text.trim()){status.textContent="Cole a Pricing Sheet + matriz de OI antes de processar.";return}
    try{
      const r=Core.computeFromText(text,a);
      state.current[a]=r;state.source[a]="MANUAL";
      renderResult(a,r,"ENTRADA MANUAL");
      saveHistory(a,r);
      const q=r.quality||{};
      status.innerHTML='<strong>'+html(r.dataStatus)+'</strong> · Pricing '+fmtInt(q.pricingRows)+' · OI '+fmtInt(q.oiRows)+' · GEX '+fmtInt(q.matchedStrikes)+' strikes';
    }catch(err){
      status.innerHTML='<span class="neg">'+html(err.message||String(err))+'</span>';
    }
  }
  function rowToResult(a,row){
    return{
      parserVersion:row.parser_version||"OPTIONS_V1",
      asset:a,assetLabel:cfg(a).label,
      series:row.series_short,
      referencePrice:n(row.reference_price),
      atmStrike:n(row.atm_strike),
      atmIvPct:n(row.atm_iv_pct),
      atmCallDelta:null,atmPutDelta:null,
      dteDays:n(row.dte_days),
      dteMinutes:row.dte_days==null?null:Number(row.dte_days)*1440,
      dp1:n(row.dp1),dp1Tick:row.dp1==null?null:Core.roundToTick(Number(row.dp1),cfg(a).tick),
      levels:{
        p1:{tick:n(row.dp_p1)},p2:{tick:n(row.dp_p2)},p3:{tick:n(row.dp_p3)},
        m1:{tick:n(row.dp_m1)},m2:{tick:n(row.dp_m2)},m3:{tick:n(row.dp_m3)}
      },
      cwC:row.cw_c==null?null:Number(row.cw_c),cwCallOi:row.quality?.cwCallOi||null,
      pwC:row.pw_c==null?null:Number(row.pw_c),pwPutOi:row.quality?.pwPutOi||null,
      gfC:row.gf_c==null?null:Number(row.gf_c),gfCTick:row.gf_c==null?null:Number(row.gf_c),
      callGex:row.call_gex==null?null:Number(row.call_gex),
      putGex:row.put_gex==null?null:Number(row.put_gex),
      netGex:row.net_gex==null?null:Number(row.net_gex),
      gammaRegime:row.gamma_regime,
      dataStatus:row.data_status,
      quality:row.quality||{},
      warnings:[]
    };
  }
  async function loadAuto(a){
    const box=el("optAuto"+a);
    if(!box||typeof window.api!=="function")return;
    try{
      const rows=await window.api("riskdesk_options_snapshot","select=*&asset=eq."+encodeURIComponent(a)+"&order=collected_at.desc&limit=1");
      const row=rows&&rows[0];
      if(!row){
        box.innerHTML='<div class="opt-auto-head"><b>Coletor automático</b><span class="badge">SEM SNAPSHOT</span></div><div class="opt-auto-data">Aguardando a Etapa 2 publicar a primeira coleta.</div>';
        return;
      }
      state.auto[a]=row;
      const when=new Date(row.collected_at).toLocaleString("pt-BR");
      box.innerHTML='<div class="opt-auto-head"><b>Coletor automático</b>'+badge(row.data_status)+'</div>'+
        '<div class="opt-auto-data">'+html(when)+' · '+html(row.series_short||"—")+' · PR '+html(fmtPrice(a,row.reference_price))+
        ' · CW '+html(fmtPrice(a,row.cw_c))+' · GF '+html(fmtPrice(a,row.gf_c))+' · PW '+html(fmtPrice(a,row.pw_c))+'</div>'+
        '<div class="opt-actions"><button type="button" class="btn" id="optUseAuto'+a+'">Usar esta coleta no painel</button></div>';
      const b=el("optUseAuto"+a);
      if(b)b.onclick=function(){
        const r=rowToResult(a,row);
        state.current[a]=r;state.source[a]="COLLECTOR";
        renderResult(a,r,"COLETOR AUTOMÁTICO · "+when);
        el("optStatus"+a).innerHTML='<strong>AUTOMÁTICO</strong> · snapshot '+html(when);
      };
      if(state.source[a]!=="MANUAL"){
        const r=rowToResult(a,row);
        state.current[a]=r;state.source[a]="COLLECTOR";
        renderResult(a,r,"COLETOR AUTOMÁTICO · "+when);
      }
    }catch(err){
      box.innerHTML='<div class="opt-auto-head"><b>Coletor automático</b><span class="badge bwarn">INDISPONÍVEL</span></div><div class="opt-auto-data">'+html(err.message||String(err))+'</div>';
    }
  }
  function bind(a){
    el("optProcess"+a).onclick=()=>process(a);
    el("optClear"+a).onclick=()=>{
      el("optInput"+a).value="";
      el("optStatus"+a).textContent="Entrada limpa. O último resultado permanece até novo processamento.";
    };
    const h=el("optClearHistory"+a);if(h)h.onclick=()=>clearHistory(a);
    renderResult(a,null);
    renderHistory(a);
    loadAuto(a);
  }
  assets.forEach(bind);
  setInterval(()=>{if(document.visibilityState!=="hidden")assets.forEach(loadAuto)},60000);
})();
