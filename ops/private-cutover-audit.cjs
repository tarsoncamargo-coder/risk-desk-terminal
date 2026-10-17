'use strict';
/** Read-only preflight for owner-only migration. NEVER declares private hosting proven by itself. */
const fs=require('node:fs'),path=require('node:path');
const TABS=['hoje','evento','leitura','macro','nasdaq','ouro','opcoes','historico','sistema'];
const read=(root,p)=>{try{return fs.readFileSync(path.join(root,p),'utf8')}catch{return null}};
function audit(root){
 const html=read(root,'index.html'),client=read(root,'app.js'),pages=read(root,'.github/workflows/pages.yml');
 const tabs=html?[...html.matchAll(/<button\b[^>]*\bdata-p=["']([^"']+)["']/g)].map(m=>m[1]):[];
 const navOk=tabs.length===TABS.length&&TABS.every(t=>tabs.includes(t));
 const pagesActive=Boolean(pages&&/uses:\s*actions\/deploy-pages@/.test(pages)&&/branches:\s*\[["']main["']\]/.test(pages));
 const directPostgrest=Boolean(client&&client.includes('/rest/v1/'));
 const result=!navOk?'BLOCK_NAVIGATION_CHANGED':!pagesActive?'BLOCK_PAGES_REMOVED_PREMATURELY':!directPostgrest?'BLOCK_LEGACY_DATA_PATH_CHANGED':'PREPARATION_ONLY';
 return {result,navigation_tabs:tabs.length,legacy_pages_active:pagesActive,legacy_direct_postgrest:directPostgrest,cutover_ready:false,remote_verifications:['GitHub Pages and repository visibility','Vercel SSO scope and allowed team members','Single verified owner login','Supabase RLS and per-user authorization','Provider license','Browser E2E and rollback']};
}
if(require.main===module){
 const root=process.argv.find(x=>x.startsWith('--root='))?.slice(7)||process.cwd();
 const r=audit(root);process.stdout.write(JSON.stringify(r,null,2)+'\n');
 if(process.argv.includes('--expect-parallel')&&r.result!=='PREPARATION_ONLY')process.exitCode=1;
 if(process.argv.includes('--require-private-cutover'))process.exitCode=2;
}
module.exports={audit,TABS};
