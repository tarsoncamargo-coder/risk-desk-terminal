import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {createRequire} from "node:module";
import {chromium} from "playwright";

const require=createRequire(import.meta.url);
const Core=require("../options-core.js");
const ROOT=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/,m=>m.slice(1)));
const configPath=process.env.RISKDESK_OPTIONS_CONFIG||path.join(ROOT,"config.json");

async function readConfig(){
  const raw=await fs.readFile(configPath,"utf8").catch(()=>null);
  if(!raw)throw new Error("Crie collector/config.json copiando config.example.json e informe as URLs do QuickStrike.");
  return JSON.parse(raw);
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function bodyText(page){
  return page.locator("body").innerText().catch(()=> "");
}
async function clickIfPossible(locator){
  try{
    if(await locator.count()===0)return false;
    const b=locator.first();
    if(!(await b.isVisible()))return false;
    if(await b.isDisabled().catch(()=>false))return false;
    await b.click({timeout:2500});
    return true;
  }catch(_){return false}
}
async function collectPagedOi(page,url,cfg){
  await page.goto(url,{waitUntil:"domcontentloaded",timeout:90000});
  await sleep(cfg.waitAfterNavigationMs||1800);
  const chunks=new Set();
  let current=await bodyText(page);chunks.add(current);
  const up=page.getByText("Page Up",{exact:true});
  for(let i=0;i<(cfg.maxOiPages||30);i++){
    const before=current;
    if(!(await clickIfPossible(up)))break;
    await sleep(650);current=await bodyText(page);chunks.add(current);
    if(current===before)break;
  }
  const down=page.getByText("Page Down",{exact:true});
  for(let i=0;i<(cfg.maxOiPages||30);i++){
    const before=current;
    if(!(await clickIfPossible(down)))break;
    await sleep(650);current=await bodyText(page);chunks.add(current);
    if(current===before)break;
  }
  return Array.from(chunks).join("\n\n");
}
async function collectPricing(page,url,cfg){
  await page.goto(url,{waitUntil:"domcontentloaded",timeout:90000});
  await sleep(cfg.waitAfterNavigationMs||1800);
  return bodyText(page);
}
async function publish(result){
  const base=process.env.SUPABASE_URL||"https://pkmjknlbsptqhanejddm.supabase.co";
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)return{published:false,reason:"SUPABASE_SERVICE_ROLE_KEY não definida; snapshot salvo apenas localmente."};
  const payload=Core.snapshotPayload(result,"COLLECTOR");
  payload.quality={...(payload.quality||{}),cwCallOi:result.cwCallOi,pwPutOi:result.pwPutOi};
  const r=await fetch(base+"/rest/v1/riskdesk_options_snapshot",{
    method:"POST",
    headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:"return=minimal"},
    body:JSON.stringify(payload)
  });
  if(!r.ok)throw new Error("Supabase "+r.status+": "+await r.text());
  return{published:true};
}
async function main(){
  const cfg=await readConfig();
  const profile=path.resolve(ROOT,cfg.profileDir||".quickstrike-profile");
  const context=await chromium.launchPersistentContext(profile,{headless:!!cfg.headless});
  const outDir=path.join(ROOT,"out");await fs.mkdir(outDir,{recursive:true});
  try{
    for(const item of cfg.assets||[]){
      if(!Core.ASSETS[item.asset])continue;
      if(!item.pricingUrl||!item.oiUrl||item.pricingUrl.startsWith("COLE_")||item.oiUrl.startsWith("COLE_")){
        console.log(item.asset+": URLs ainda não configuradas.");continue;
      }
      const page=await context.newPage();
      console.log("\n["+item.asset+"] coletando Pricing Sheet...");
      const pricing=await collectPricing(page,item.pricingUrl,cfg);
      console.log("["+item.asset+"] coletando cadeia de Open Interest...");
      const oi=await collectPagedOi(page,item.oiUrl,cfg);
      const combined=pricing+"\n\n"+oi;
      const result=Core.computeFromText(combined,item.asset);
      if(result.series&&result.matrixSeries&&result.series!==result.matrixSeries){
        throw new Error(item.asset+": série da Pricing Sheet difere da matriz OI. Snapshot não publicado.");
      }
      const stamp=new Date().toISOString().replace(/[:.]/g,"-");
      await fs.writeFile(path.join(outDir,item.asset+"-"+stamp+".txt"),combined,"utf8");
      await fs.writeFile(path.join(outDir,item.asset+"-"+stamp+".json"),JSON.stringify(result,null,2),"utf8");
      const pub=await publish(result);
      console.log("["+item.asset+"] "+result.dataStatus+
        " | série "+(result.series||"—")+" | PR "+result.referencePrice+
        " | ATM "+result.atmStrike+" | IV "+result.atmIvPct+
        " | CW "+result.cwC+" | GF "+result.gfCTick+" | PW "+result.pwC+
        " | Net GEX "+result.netGex);
      if(!pub.published)console.log("["+item.asset+"] "+pub.reason);
      await page.close();
    }
  }finally{await context.close();}
}
main().catch(err=>{console.error("\nERRO:",err.message||err);process.exitCode=1;});
