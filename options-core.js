/* Risk Desk Options Core V1
   Isolated options parser/calculator. It does not read or write GEN1, GEN2,
   Market State, macro, confluence, risk, or trading state. */
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.RiskDeskOptionsCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const VERSION="OPTIONS_V1.0.0";
  const ASSETS={
    MGC:{label:"Gold / MGC",multiplier:100,tick:0.1,priceDigits:1},
    MNQ:{label:"Nasdaq / MNQ",multiplier:20,tick:0.25,priceDigits:2}
  };

  function cleanCell(v){
    return String(v==null?"":v)
      .replace(/\[([^\]]+)\]\([^\)]+\)/g,"$1")
      .replace(/\*\*/g,"")
      .replace(/\u00a0/g," ")
      .trim();
  }
  function toNumber(v){
    let s=cleanCell(v).replace(/\s+/g,"");
    if(!s||s==="—"||s==="-")return null;
    s=s.replace(/[%$]/g,"");
    if(/^[-+]?\d{1,3}(\.\d{3})+,\d+$/.test(s))s=s.replace(/\./g,"").replace(",",".");
    else if(/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s))s=s.replace(/,/g,"");
    else if(/^[-+]?\d+,\d+$/.test(s)&&!s.includes("."))s=s.replace(",",".");
    else s=s.replace(/,/g,"");
    const n=Number(s);
    return Number.isFinite(n)?n:null;
  }
  function splitCells(line){
    if(line.includes("|")){
      let a=line.split("|").map(cleanCell);
      if(a.length&&a[0]==="")a=a.slice(1);
      if(a.length&&a[a.length-1]==="")a=a.slice(0,-1);
      return a;
    }
    if(line.includes("\t"))return line.split("\t").map(cleanCell);
    return line.trim().split(/\s{2,}/).map(cleanCell);
  }
  function normalize(text){return String(text||"").replace(/\r/g,"");}
  function detectAsset(text,expected){
    if(expected&&ASSETS[expected])return expected;
    const t=normalize(text).toUpperCase();
    if(/NASDAQ|MNQ|NQ\||\bNQ[FGHJKMNQUVXZ]\d\b|\bQ\w{2,7}\b/.test(t))return"MNQ";
    if(/GOLD|MGC|OG\||\bGC[FGHJKMNQUVXZ]\d\b|\bG\w{2,7}\b/.test(t))return"MGC";
    return null;
  }
  function parseHeader(text){
    const t=normalize(text).replace(/\s+/g," ");
    const h=t.match(/\b([A-Z0-9]{4,9})\s*\(\s*([\d.,]+)\s*DTE\s*\)\s*vs\s*([\d.,]+)/i);
    const banner=t.match(/\bat\s*([\d.,]+)\s*%\s*Volatility/i);
    if(h)return{series:h[1].toUpperCase(),dte:toNumber(h[2]),pr:toNumber(h[3]),bannerIv:banner?toNumber(banner[1]):null,source:"PRICING_SHEET"};
    const future=t.match(/\bFuture\s*[:=]?\s*([\d.,]+)/i);
    const days=t.match(/\bDays\s*[:=]?\s*([\d.,]+)/i);
    const strike=t.match(/\bStrike\s*[:=]?\s*([\d.,]+)/i);
    const vol=t.match(/\bVol(?:atility)?\s*\(%?\)?\s*[:=]?\s*([\d.,]+)/i);
    if(future&&days)return{series:null,dte:toNumber(days[1]),pr:toNumber(future[1]),bannerIv:vol?toNumber(vol[1]):null,calculatorStrike:strike?toNumber(strike[1]):null,source:"OPTIONS_CALCULATOR_FALLBACK"};
    return{series:null,dte:null,pr:null,bannerIv:null,source:null};
  }
  function parsePricingRows(text){
    const rows=[];
    for(const line of normalize(text).split("\n")){
      const c=splitCells(line);
      if(c.length<8)continue;
      const iv=toNumber(c[0]),dc=toNumber(c[1]),strike=toNumber(c[4]),dp=toNumber(c[7]);
      if(iv==null||strike==null||dc==null||dp==null)continue;
      if(iv<=0||iv>500||strike<500||dc<0||dc>1.05||dp>0.05||dp<-1.05)continue;
      const gamma=c.length>9?toNumber(c[9]):null;
      rows.push({
        strike,
        ivPct:iv,
        callDelta:dc,
        putDelta:dp,
        gamma:gamma,
        callPrice:c.length>3?toNumber(c[3]):null,
        putPrice:c.length>5?toNumber(c[5]):null
      });
    }
    const map=new Map();
    rows.forEach(r=>map.set(r.strike,r));
    return Array.from(map.values()).sort((a,b)=>a.strike-b.strike);
  }
  function parseMatrixSeries(text){
    const lines=normalize(text).split("\n");
    for(const line of lines){
      const c=splitCells(line);
      if(c.length>=2&&/^STRIKE$/i.test(c[0])&&/^[A-Z0-9]{4,9}$/i.test(c[1]))return c[1].toUpperCase();
      const m=line.match(/^\s*Strike\s+([A-Z0-9]{4,9})/i);
      if(m)return m[1].toUpperCase();
    }
    return null;
  }
  function parseOiRows(text){
    const lines=normalize(text).split("\n");
    let start=0;
    for(let i=0;i<lines.length;i++){
      const c=splitCells(lines[i]);
      if(c.length>=2&&/^STRIKE$/i.test(c[0])&&/^[A-Z0-9]{4,9}$/i.test(c[1])){start=i+1;break;}
    }
    const rows=[];
    for(let i=start;i<lines.length;i++){
      const c=splitCells(lines[i]);
      if(c.length<3)continue;
      const strike=toNumber(c[0]);
      if(strike==null||strike<500)continue;
      const call=toNumber(c[1])||0;
      const put=toNumber(c[2])||0;
      if(call<0||put<0)continue;
      rows.push({strike,callOi:Math.round(call),putOi:Math.round(put)});
    }
    const map=new Map();
    rows.forEach(r=>map.set(r.strike,r));
    return Array.from(map.values()).sort((a,b)=>a.strike-b.strike);
  }
  function nearestAtm(pr,rows){
    if(pr==null||!rows.length)return null;
    return rows.reduce((best,r)=>{
      if(!best)return r;
      const da=Math.abs(r.strike-pr),db=Math.abs(best.strike-pr);
      if(da<db)return r;
      if(da===db&&Math.abs(r.callDelta-.5)<Math.abs(best.callDelta-.5))return r;
      return best;
    },null);
  }
  function normalPdf(x){return Math.exp(-0.5*x*x)/Math.sqrt(2*Math.PI);}
  function black76Gamma(s,k,sigma,t){
    if(!(s>0&&k>0&&sigma>0&&t>0))return 0;
    const st=sigma*Math.sqrt(t);
    if(!(st>0))return 0;
    const d1=(Math.log(s/k)+0.5*sigma*sigma*t)/st;
    return normalPdf(d1)/(s*st);
  }
  function roundToTick(v,tick){
    if(v==null||!Number.isFinite(v))return null;
    return Math.round(v/tick)*tick;
  }
  function gexAtPrice(price,matched,t,multiplier){
    let call=0,put=0;
    const scale=multiplier*price*price*0.01;
    for(const r of matched){
      const sigma=r.ivPct/100;
      const g=black76Gamma(price,r.strike,sigma,t);
      call+=g*r.callOi*scale;
      put-=g*r.putOi*scale;
    }
    return{call,put,net:call+put};
  }
  function findGammaFlip(pr,dp1,matched,t,multiplier){
    if(!(pr>0&&matched.length>=2&&t>0))return null;
    const span=Math.max((dp1||0)*6,pr*0.10);
    const lo=Math.max(1,pr-span),hi=pr+span,steps=480;
    let prev=null,best=null;
    for(let i=0;i<=steps;i++){
      const s=lo+(hi-lo)*(i/steps);
      const net=gexAtPrice(s,matched,t,multiplier).net;
      if(prev){
        if(net===0){
          const cand=s;
          if(best==null||Math.abs(cand-pr)<Math.abs(best-pr))best=cand;
        }else if(prev.net===0||prev.net*net<0){
          const denom=net-prev.net;
          const cand=denom===0?s:prev.s+(0-prev.net)*(s-prev.s)/denom;
          if(Number.isFinite(cand)&&(best==null||Math.abs(cand-pr)<Math.abs(best-pr)))best=cand;
        }
      }
      prev={s,net};
    }
    return best;
  }
  function maxWall(rows,key){
    if(!rows.length)return null;
    let best=null;
    for(const r of rows){
      const v=Number(r[key]||0);
      if(!best||v>best.oi)best={strike:r.strike,oi:v};
    }
    return best&&best.oi>0?best:null;
  }
  function computeFromText(text,expectedAsset){
    const raw=normalize(text);
    const asset=detectAsset(raw,expectedAsset);
    if(!asset)throw new Error("Não foi possível identificar o ativo (Gold/MGC ou Nasdaq/MNQ).");
    const cfg=ASSETS[asset];
    const h=parseHeader(raw);
    const pricing=parsePricingRows(raw);
    const oi=parseOiRows(raw);
    const matrixSeries=parseMatrixSeries(raw);
    const warnings=[];
    if(h.source==="OPTIONS_CALCULATOR_FALLBACK")warnings.push("PR obtido pelo Options Calculator; para a regra oficial do Risk Desk prefira o cabeçalho da Pricing Sheet com 'vs'.");
    if(h.pr==null)warnings.push("Falta o PR: cole o cabeçalho da Pricing Sheet contendo 'vs'.");
    if(h.dte==null)warnings.push("Falta o DTE da Pricing Sheet.");
    if(!pricing.length)warnings.push("Pricing Sheet não reconhecida: faltam IV/Delta por strike.");
    if(!oi.length)warnings.push("Matriz de Open Interest não reconhecida.");
    if(h.series&&matrixSeries&&h.series!==matrixSeries)warnings.push("Série da Pricing Sheet ("+h.series+") difere da primeira série da matriz de OI ("+matrixSeries+").");

    const atm=nearestAtm(h.pr,pricing);
    if(!atm&&h.pr!=null)warnings.push("Não foi possível localizar o ATM na Pricing Sheet.");
    const ivPct=atm?atm.ivPct:null;
    const dte=h.dte,pr=h.pr;
    const dp1=pr!=null&&ivPct!=null&&dte>0?pr*(ivPct/100)*Math.sqrt(dte/365):null;
    const levels={};
    if(dp1!=null){
      for(const n of [-3,-2,-1,1,2,3]){
        const exact=pr+n*dp1;
        levels[(n>0?"p":"m")+Math.abs(n)]={exact,tick:roundToTick(exact,cfg.tick)};
      }
    }

    const cw=maxWall(oi,"callOi"),pw=maxWall(oi,"putOi");
    const pm=new Map(pricing.map(r=>[r.strike,r]));
    const matched=oi.map(o=>{
      const p=pm.get(o.strike);
      return p?{strike:o.strike,callOi:o.callOi,putOi:o.putOi,ivPct:p.ivPct}:null;
    }).filter(Boolean);
    const t=dte>0?dte/365:null;
    let gex=null,flip=null;
    if(pr>0&&t>0&&matched.length){
      gex=gexAtPrice(pr,matched,t,cfg.multiplier);
      flip=findGammaFlip(pr,dp1,matched,t,cfg.multiplier);
    }else if(oi.length&&pricing.length){
      warnings.push("GEX/Gamma Flip não calculados por falta de PR ou DTE válidos.");
    }
    if(!matched.length&&oi.length&&pricing.length)warnings.push("Nenhum strike da matriz de OI coincidiu com a Pricing Sheet.");

    const pricingMin=pricing.length?pricing[0].strike:null;
    const pricingMax=pricing.length?pricing[pricing.length-1].strike:null;
    const oiMin=oi.length?oi[0].strike:null;
    const oiMax=oi.length?oi[oi.length-1].strike:null;
    const pricingCoverage=dp1!=null&&pricingMin!=null&&pricingMax!=null&&pricingMin<=pr-3*dp1&&pricingMax>=pr+3*dp1;
    const oiCoverage=dp1!=null&&oiMin!=null&&oiMax!=null&&oi.length>=80&&oiMin<=pr-4*dp1&&oiMax>=pr+4*dp1;
    if(oi.length&&!oiCoverage)warnings.push("Cadeia de OI parece parcial; CW/PW/GF devem ser tratados como provisórios.");
    if(pricing.length&&!pricingCoverage)warnings.push("Pricing Sheet cobre faixa limitada para o cálculo de Gamma Flip.");
    if(flip==null&&matched.length>=2)warnings.push("Nenhum cruzamento de Net GEX foi encontrado na faixa pesquisada.");

    const complete=!!(h.pr!=null&&h.dte>0&&atm&&oi.length&&pricingCoverage&&oiCoverage&&(!h.series||!matrixSeries||h.series===matrixSeries));
    return{
      parserVersion:VERSION,
      asset,
      assetLabel:cfg.label,
      multiplier:cfg.multiplier,
      tickSize:cfg.tick,
      series:h.series||matrixSeries||null,
      matrixSeries,
      referencePrice:pr,
      dteDays:dte,
      dteMinutes:dte!=null?dte*1440:null,
      atmStrike:atm?atm.strike:(h.calculatorStrike||null),
      atmIvPct:ivPct!=null?ivPct:h.bannerIv,
      atmCallDelta:atm?atm.callDelta:null,
      atmPutDelta:atm?atm.putDelta:null,
      bannerIvPct:h.bannerIv,
      dp1,
      dp1Tick:dp1!=null?roundToTick(dp1,cfg.tick):null,
      levels,
      cwC:cw?cw.strike:null,
      cwCallOi:cw?cw.oi:null,
      pwC:pw?pw.strike:null,
      pwPutOi:pw?pw.oi:null,
      gfC:flip,
      gfCTick:flip!=null?roundToTick(flip,cfg.tick):null,
      callGex:gex?gex.call:null,
      putGex:gex?gex.put:null,
      netGex:gex?gex.net:null,
      gammaRegime:gex?(gex.net>=0?"POSITIVO":"NEGATIVO"):null,
      dataStatus:complete?"COMPLETO":"PARCIAL",
      quality:{
        pricingRows:pricing.length,
        oiRows:oi.length,
        matchedStrikes:matched.length,
        pricingMin,pricingMax,oiMin,oiMax,
        pricingCoverage,oiCoverage,
        headerSource:h.source,
        seriesMatch:!h.series||!matrixSeries||h.series===matrixSeries
      },
      warnings
    };
  }
  function snapshotPayload(result,sourceMode,collectedAt){
    const L=result.levels||{};
    return{
      asset:result.asset,
      source_mode:sourceMode||"COLLECTOR",
      series_short:result.series,
      reference_price:result.referencePrice,
      atm_strike:result.atmStrike,
      atm_iv_pct:result.atmIvPct,
      dte_days:result.dteDays,
      dp1:result.dp1,
      dp_p1:L.p1?L.p1.tick:null,
      dp_p2:L.p2?L.p2.tick:null,
      dp_p3:L.p3?L.p3.tick:null,
      dp_m1:L.m1?L.m1.tick:null,
      dp_m2:L.m2?L.m2.tick:null,
      dp_m3:L.m3?L.m3.tick:null,
      cw_c:result.cwC,
      pw_c:result.pwC,
      gf_c:result.gfCTick,
      call_gex:result.callGex,
      put_gex:result.putGex,
      net_gex:result.netGex,
      gamma_regime:result.gammaRegime,
      data_status:result.dataStatus,
      quality:{
        ...(result.quality||{}),
        atmCallDelta:result.atmCallDelta,
        atmPutDelta:result.atmPutDelta,
        bannerIvPct:result.bannerIvPct,
        dp1Tick:result.dp1Tick,
        cwCallOi:result.cwCallOi,
        pwPutOi:result.pwPutOi,
        matrixSeries:result.matrixSeries,
        warnings:Array.isArray(result.warnings)?result.warnings:[]
      },
      collected_at:collectedAt||new Date().toISOString(),
      parser_version:result.parserVersion
    };
  }
  return{VERSION,ASSETS,toNumber,parseHeader,parsePricingRows,parseOiRows,parseMatrixSeries,black76Gamma,roundToTick,computeFromText,snapshotPayload};
});
