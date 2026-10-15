/* Risk Desk Options Tab V1.1
   Presentation/persistence only. Manual and collector snapshots remain isolated
   from GEN1, GEN2, Market State, macro, confluence, risk and trading logic. */
(function(){
  "use strict";
  const Core=window.RiskDeskOptionsCore;
  if(!Core)return;

  const assets=["MGC","MNQ"];
  const state={current:{MGC:null,MNQ:null},source:{MGC:null,MNQ:null},auto:{MGC:null,MNQ:null}};
  const el=id=>document.getElementById(id);
  const html=x=>String(x==null?"":x).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const cfg=a=>Core.ASSETS[a];
  const n=v=>v==null||v===""?null:Number(v);
  const fmt=(v,d=2)=>v==null||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
  const fmtPrice=(a,v)=>fmt(v,cfg(a).priceDigits);
  const fmtInt=v=>v==null||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString("pt-BR",{maximumFractionDigits:0});
  const fmtGex=v=>v==null||!Number.isFinite(Number(v))?"—":(Number(v)/1e6).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+" M";
  const tone=v=>Number(v)>0?"pos":Number(v)<0?"neg":"";
  const storageKey=a=>"riskdesk_options_history_v1_"+a;
  const latestKey=a=>"riskdesk_options_latest_v2_"+a;
  const HISTORY_LIMIT=365;

  function readJson(key,fallback){
    try{
      const raw=localStorage.getItem(key);
      return raw?JSON.parse(raw):fallback;
    }catch(_){return fallback}
  }
  function writeJson(key,value){
    try{localStorage.setItem(key,JSON.stringify(value));return true}
    catch(_){return false}
  }
  function history(a){
    const list=readJson(storageKey(a),[]);
    return Array.isArray(list)?list:[];
  }
  function rowToResult(a,row){
    const q=row&&row.quality||{};
    return{
      parserVersion:row?.parser_version||"OPTIONS_V1",
      asset:a,
      assetLabel:cfg(a).label,
      multiplier:cfg(a).multiplier,
      tickSize:cfg(a).tick,
      series:row?.series_short||null,
      matrixSeries:q.matrixSeries||null,
      referencePrice:n(row?.reference_price),
      dteDays:n(row?.dte_days),
      dteMinutes:row?.dte_minutes!=null?n(row.dte_minutes):(row?.dte_days==null?null:Number(row.dte_days)*1440),
      atmStrike:n(row?.atm_strike),
      atmIvPct:n(row?.atm_iv_pct),
      atmCallDelta:n(q.atmCallDelta),
      atmPutDelta:n(q.atmPutDelta),
      bannerIvPct:n(q.bannerIvPct),
      dp1:n(row?.dp1),
      dp1Tick:q.dp1Tick==null?(row?.dp1==null?null:Core.roundToTick(Number(row.dp1),cfg(a).tick)):n(q.dp1Tick),
      levels:{
        p1:{tick:n(row?.dp_p1)},p2:{tick:n(row?.dp_p2)},p3:{tick:n(row?.dp_p3)},
        m1:{tick:n(row?.dp_m1)},m2:{tick:n(row?.dp_m2)},m3:{tick:n(row?.dp_m3)}
      },
      cwC:n(row?.cw_c),
      cwCallOi:n(q.cwCallOi),
      pwC:n(row?.pw_c),
      pwPutOi:n(q.pwPutOi),
      gfC:n(row?.gf_c),
      gfCTick:n(row?.gf_c),
      callGex:n(row?.call_gex),
      putGex:n(row?.put_gex),
      netGex:n(row?.net_gex),
      gammaRegime:row?.gamma_regime||null,
      dataStatus:row?.data_status||"PARCIAL",
      quality:q,
      warnings:Array.isArray(q.warnings)?q.warnings:(Array.isArray(row?.warnings)?row.warnings:[])
    };
  }
  function resultFromHistoryEntry(a,entry){
    if(entry&&entry.result&&typeof entry.result==="object")return entry.result;
    return entry?rowToResult(a,entry):null;
  }
  function saveLatest(a,r,source,rawText,collectedAt){
    const payload={
      schemaVersion:2,
      collected_at:collectedAt||new Date().toISOString(),
      source:source||"MANUAL_LOCAL",
      result:r,
      rawText:rawText&&rawText.length<=1500000?rawText:null
    };
    writeJson(latestKey(a),payload);
  }
  function saveHistory(a,r,source,collectedAt){
    const entry={
      schemaVersion:2,
      collected_at:collectedAt||new Date().toISOString(),
      source:source||"MANUAL_LOCAL",
      result:r
    };
    let list=[entry,...history(a)].slice(0,HISTORY_LIMIT);
    while(list.length){
      if(writeJson(storageKey(a),list))break;
      list=list.slice(0,-1);
    }
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
  function card(k,v,s){
    return '<div class="opt-card"><div class="k">'+html(k)+'</div><div class="v">'+html(v)+'</div><div class="s">'+html(s||"")+'</div></div>';
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
      card("ATM",fmtPrice(a,r.atmStrike),"Delta Call "+fmt(r.atmCallDelta,2)+" · Put "+fmt(r.atmPutDelta,2))+
      card("IV ATM",r.atmIvPct==null?"—":fmt(r.atmIvPct,2)+"%","volatilidade do strike ATM")+
      card("DTE",r.dteDays==null?"—":fmt(r.dteDays,2)+" dias","tempo até o vencimento")+
      card("DTE MINUTOS",r.dteMinutes==null?"—":fmt(r.dteMinutes,1)+" min","DTE × 1.440")+
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
  function renderResult(a,r,sourceLabel){
    const box=el("optResults"+a);
    if(!box)return;
    if(!r){box.innerHTML='<div class="muted">Cole os dados do QuickStrike e clique em Processar.</div>';return}
    box.innerHTML=resultCards(a,r,sourceLabel);
  }
  function historyDetails(a,r,entry,index){
    const L=r.levels||{},q=r.quality||{};
    const when=entry?.collected_at?new Date(entry.collected_at).toLocaleString("pt-BR"):"—";
    const source=entry?.source||"MANUAL_LOCAL";
    const gf=r.gfCTick!=null?r.gfCTick:r.gfC;
    const fields=[
      ["Data / hora",when],["Fonte",source],["Série",r.series||"—"],["Série matriz OI",r.matrixSeries||q.matrixSeries||"—"],
      ["PR",fmtPrice(a,r.referencePrice)],["ATM",fmtPrice(a,r.atmStrike)],["Delta Call",fmt(r.atmCallDelta,2)],["Delta Put",fmt(r.atmPutDelta,2)],
      ["IV ATM",r.atmIvPct==null?"—":fmt(r.atmIvPct,2)+"%"],["IV cabeçalho",r.bannerIvPct==null?"—":fmt(r.bannerIvPct,2)+"%"],
      ["DTE",fmt(r.dteDays,2)+" dias"],["DTE minutos",fmt(r.dteMinutes,1)],["DP1",fmt(r.dp1,2)+" pts"],["DP1 tick",fmt(r.dp1Tick,2)],
      ["DP -3",fmtPrice(a,L.m3?.tick)],["DP -2",fmtPrice(a,L.m2?.tick)],["DP -1",fmtPrice(a,L.m1?.tick)],
      ["DP +1",fmtPrice(a,L.p1?.tick)],["DP +2",fmtPrice(a,L.p2?.tick)],["DP +3",fmtPrice(a,L.p3?.tick)],
      ["CW-C",fmtPrice(a,r.cwC)],["Call OI no CW",fmtInt(r.cwCallOi)],["GF-C",fmtPrice(a,gf)],["PW-C",fmtPrice(a,r.pwC)],["Put OI no PW",fmtInt(r.pwPutOi)],
      ["Call GEX",fmtGex(r.callGex)],["Put GEX",fmtGex(r.putGex)],["Net GEX",fmtGex(r.netGex)],["Regime Gamma",r.gammaRegime||"—"],
      ["Status",r.dataStatus||"—"],["Pricing rows",fmtInt(q.pricingRows)],["OI rows",fmtInt(q.oiRows)],["Strikes GEX",fmtInt(q.matchedStrikes)],
      ["Faixa Pricing",(q.pricingMin==null?"—":fmtPrice(a,q.pricingMin))+" → "+(q.pricingMax==null?"—":fmtPrice(a,q.pricingMax))],
      ["Faixa OI",(q.oiMin==null?"—":fmtPrice(a,q.oiMin))+" → "+(q.oiMax==null?"—":fmtPrice(a,q.oiMax))],
      ["Cobertura Pricing",q.pricingCoverage===true?"OK":q.pricingCoverage===false?"PARCIAL":"—"],
      ["Cobertura OI",q.oiCoverage===true?"OK":q.oiCoverage===false?"PARCIAL":"—"],
      ["Parser",r.parserVersion||"—"]
    ];
    const warnings=(r.warnings||[]).map(w=>'<div class="opt-warning">'+html(w)+'</div>').join("");
    return '<details class="opt-history-item">'+
      '<summary><span>'+html(when)+'</span><b>'+html(r.series||"sem série")+'</b><span>PR '+html(fmtPrice(a,r.referencePrice))+'</span>'+badge(r.dataStatus)+'</summary>'+
      '<div class="opt-history-full">'+fields.map(x=>'<div><span>'+html(x[0])+'</span><b>'+html(x[1])+'</b></div>').join("")+'</div>'+
      '<div class="opt-warnings">'+warnings+'</div>'+
      '<div class="opt-actions"><button class="btn" type="button" data-opt-restore="'+index+'" data-opt-asset="'+a+'">Restaurar este cálculo no painel</button></div>'+
      '</details>';
  }
  function renderHistory(a){
    const box=el("optHistory"+a);
    if(!box)return;
    const list=history(a);
    if(!list.length){box.innerHTML='<div class="muted">Nenhum cálculo salvo neste navegador.</div>';return}
    box.innerHTML=list.map((entry,index)=>{
      const r=resultFromHistoryEntry(a,entry);
      return r?historyDetails(a,r,entry,index):"";
    }).join("");
    box.querySelectorAll("[data-opt-restore]").forEach(button=>{
      button.onclick=function(){
        const idx=Number(button.dataset.optRestore);
        const entry=history(a)[idx];
        const r=resultFromHistoryEntry(a,entry);
        if(!r)return;
        state.current[a]=r;
        state.source[a]="HISTORY";
        renderResult(a,r,"RESTAURADO DO HISTÓRICO");
        saveLatest(a,r,"HISTORY",null,entry.collected_at);
        const status=el("optStatus"+a);
        if(status)status.innerHTML='<strong>RESTAURADO</strong> · '+html(new Date(entry.collected_at).toLocaleString("pt-BR"));
      };
    });
  }
  function restoreLatest(a){
    let saved=readJson(latestKey(a),null);
    if(!saved){
      const first=history(a)[0];
      if(first){
        const r=resultFromHistoryEntry(a,first);
        if(r)saved={schemaVersion:1,collected_at:first.collected_at,source:first.source||"HISTORY",result:r,rawText:null};
      }
    }
    if(!saved||!saved.result)return false;
    const r=saved.result;
    state.current[a]=r;
    state.source[a]=saved.source||"RESTORED";
    if(saved.rawText&&el("optInput"+a))el("optInput"+a).value=saved.rawText;
    const when=saved.collected_at?new Date(saved.collected_at).toLocaleString("pt-BR"):"";
    renderResult(a,r,"ÚLTIMO CÁLCULO SALVO"+(when?" · "+when:""));
    const status=el("optStatus"+a);
    if(status)status.innerHTML='<strong>RESULTADO RESTAURADO</strong>'+(when?" · "+html(when):"");
    return true;
  }
  function process(a){
    const input=el("optInput"+a),status=el("optStatus"+a);
    const text=input?.value||"";
    if(!text.trim()){status.textContent="Cole a Pricing Sheet + matriz de OI antes de processar.";return}
    try{
      const r=Core.computeFromText(text,a);
      const now=new Date().toISOString();
      state.current[a]=r;
      state.source[a]="MANUAL";
      renderResult(a,r,"ENTRADA MANUAL");
      saveLatest(a,r,"MANUAL_LOCAL",text,now);
      saveHistory(a,r,"MANUAL_LOCAL",now);
      const q=r.quality||{};
      status.innerHTML='<strong>'+html(r.dataStatus)+'</strong> · cálculo salvo · Pricing '+fmtInt(q.pricingRows)+' · OI '+fmtInt(q.oiRows)+' · GEX '+fmtInt(q.matchedStrikes)+' strikes';
    }catch(err){
      status.innerHTML='<span class="neg">'+html(err.message||String(err))+'</span>';
    }
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
        state.current[a]=r;
        state.source[a]="COLLECTOR";
        renderResult(a,r,"COLETOR AUTOMÁTICO · "+when);
        saveLatest(a,r,"COLLECTOR",null,row.collected_at);
        saveHistory(a,r,"COLLECTOR",row.collected_at);
        el("optStatus"+a).innerHTML='<strong>AUTOMÁTICO</strong> · snapshot '+html(when)+' · salvo no histórico local';
      };
      if(!state.current[a]){
        const r=rowToResult(a,row);
        state.current[a]=r;
        state.source[a]="COLLECTOR_AUTO";
        renderResult(a,r,"COLETOR AUTOMÁTICO · "+when);
      }
    }catch(err){
      box.innerHTML='<div class="opt-auto-head"><b>Coletor automático</b><span class="badge bwarn">INDISPONÍVEL</span></div><div class="opt-auto-data">'+html(err.message||String(err))+'</div>';
    }
  }
  function bind(a){
    const processButton=el("optProcess"+a);
    const clearButton=el("optClear"+a);
    if(processButton)processButton.onclick=()=>process(a);
    if(clearButton)clearButton.onclick=()=>{
      el("optInput"+a).value="";
      el("optStatus"+a).textContent="Entrada limpa. O resultado calculado continua salvo e não será apagado ao atualizar a página.";
    };
    const h=el("optClearHistory"+a);
    if(h)h.onclick=()=>clearHistory(a);
    renderHistory(a);
    if(!restoreLatest(a))renderResult(a,null);
    loadAuto(a);
  }

  assets.forEach(bind);
  setInterval(()=>{if(document.visibilityState!=="hidden")assets.forEach(loadAuto)},60000);
})();
