/* Risk Desk: cotações visuais, sem alterar GEN1/GEN2, Market State ou confluência. */
(function () {
  "use strict";
  const symbols = [
    {key:"NQ",label:"Nasdaq (NQ)",kind:"market",digits:2,maxAge:3},
    {key:"ZT",label:"Juros 2Y (ZT)",kind:"market",digits:3,maxAge:5},
    {key:"ZN",label:"Juros 10Y (ZN)",kind:"market",digits:3,maxAge:5},
    {key:"ZQ",label:"Fed Funds (ZQ)",kind:"market",digits:3,maxAge:10},
    {key:"DXY_SYNTH",label:"DXY ActivTrades",kind:"shadow",digits:5,maxAge:1.5},
    {key:"DXY",label:"DXY Yahoo",kind:"market",digits:3,maxAge:5},
    {key:"VIX",label:"VIX",kind:"market",digits:2,maxAge:5},
    {key:"VXN",label:"VXN",kind:"market",digits:2,maxAge:5}
  ];
  let lastMarket=[],lastShadow=[],errors=[];
  const targets=["rdMarketVisualHoje","rdMarketVisualNasdaq"];
  const el=id=>document.getElementById(id);
  const fmt=(v,d)=>new Intl.NumberFormat("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d}).format(v);
  function age(date) {
    const t=date?Date.parse(date):NaN;
    return Number.isFinite(t)?(Date.now()-t)/60000:null;
  }
  function status(item,row) {
    if(!row)return "SEM DADOS";
    if(item.kind==="market"&&["OFF_SESSION_SOURCE","MARKET_CLOSED_LAST"].includes(row.quality_status))return "FORA DA SESSÃO";
    if(item.kind==="market"&&row.quality_status!=="OK")return "ATRASADO";
    if(item.kind==="shadow"&&row.quality_status!=="RECENT")return "ATRASADO";
    const minutes=age(item.kind==="shadow"?row.as_of_utc:row.ts_utc);
    if(minutes===null)return "SEM DADOS";
    return minutes>=-0.5&&minutes<=item.maxAge?"ATUALIZADO":"ATRASADO";
  }
  function pair(item) {
    const rows=item.kind==="shadow"?lastShadow:lastMarket;
    const row=rows.find(x=>x.symbol===item.key&&item.kind==="shadow"||x.asset===item.key&&item.kind==="market");
    const state=status(item,row);
    const raw=row&&(item.kind==="shadow"?row.mid:row.price);
    const value=raw==null||!Number.isFinite(Number(raw))?"—":fmt(Number(raw),item.digits);
    const timestamp=row&&(item.kind==="shadow"?row.as_of_utc:row.ts_utc);
    const a=age(timestamp),minutes=a===null?"sem horário":a<1?Math.max(0,Math.round(a*60))+"s":Math.max(0,a).toFixed(1)+"min";
    return {value,state,minutes};
  }
  function draw() {
    targets.forEach(id=>{
      const target=el(id);if(!target)return;
      target.replaceChildren();
      const header=document.createElement("div");header.className="rd-mkt-heading";
      const title=document.createElement("strong");title.textContent="Mercado agora — referência visual";
      const stamp=document.createElement("span");stamp.className="rd-mkt-foot";
      stamp.textContent="Cotações de origem identificada · sem sinal operacional";
      header.append(title,stamp);target.append(header);
      const grid=document.createElement("div");grid.className="rd-mkt-grid";
      symbols.forEach(item=>{
        const p=pair(item),box=document.createElement("div");box.className="rd-mkt-cell";
        const lab=document.createElement("div");lab.className="rd-mkt-name";lab.textContent=item.label;
        const price=document.createElement("strong");price.className="rd-mkt-price";price.textContent=p.value;
        const chip=document.createElement("div");chip.className="rd-mkt-status "+
          (p.state==="ATUALIZADO"?"rd-mkt-fresh":p.state==="ATRASADO"?"rd-mkt-stale":"rd-mkt-wait");
        chip.textContent=p.state+" · "+p.minutes;
        box.append(lab,price,chip);grid.append(box);
      });target.append(grid);
      const foot=document.createElement("p");foot.className="rd-mkt-foot";
      foot.textContent="DXY ActivTrades = índice sintético SHADOW calculado com seis pares FX; não substitui DXY Yahoo no Market State/GEN1/GEN2. Preços atrasados não são confirmação LIVE."+
      (errors.length?" Consultas com falha: "+errors.join(", "):"");
      target.append(foot);
    });
  }
  async function refresh() {
    const requests=[
      ["market",api("riskdesk_live_latest_quotes_v1","select=asset,price,ts_utc,quality_status,source")],
      ["shadow",api("riskdesk_mt5_fx_shadow","select=symbol,mid,as_of_utc,quality_status,source")]
    ];
    const settled=await Promise.allSettled(requests.map(r=>r[1]));
    errors=[];
    settled.forEach((r,i)=>{
      if(r.status==="fulfilled") {
        if(i===0)lastMarket=Array.isArray(r.value)?r.value:[];
        else lastShadow=Array.isArray(r.value)?r.value:[];
      } else { errors.push(requests[i][0]); if(i===0)lastMarket=[];else lastShadow=[]; }
    });
    draw();
  }
  if(targets.some(id=>el(id))) {
    refresh();
    setInterval(()=>{if(document.visibilityState!=="hidden")refresh();},30000);
    setInterval(()=>{if(document.visibilityState!=="hidden")draw();},10000);
  }
})();