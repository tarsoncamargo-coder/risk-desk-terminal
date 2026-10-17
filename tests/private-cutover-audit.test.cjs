'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {audit,TABS}=require('../ops/private-cutover-audit.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'rd-preflight-'));
const write=(p,s)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)};
const nav=()=>'<nav>'+TABS.map(t=>'<button data-p="'+t+'">'+t+'</button>').join('')+'</nav>';
const pages='on:\n  push:\n    branches: ["main"]\njobs:\n  deploy:\n    steps:\n      - uses: actions/deploy-pages@v4\n';
function test(name,fn){fn();console.log('PASS '+name)}
try{
 write('index.html',nav());write('app.js','fetch(URL+"/rest/v1/x")');write('.github/workflows/pages.yml',pages);
 test('nine tabs and legacy hosting preserved',()=>{const x=audit(root);assert.equal(x.result,'PREPARATION_ONLY');assert.equal(x.navigation_tabs,9);assert.equal(x.cutover_ready,false)});
 test('premature Pages deactivation is blocked',()=>{write('.github/workflows/pages.yml','validate-only');assert.equal(audit(root).result,'BLOCK_PAGES_REMOVED_PREMATURELY');write('.github/workflows/pages.yml',pages)});
 test('accidental page removal is blocked',()=>{write('index.html','<button data-p="hoje">Hoje</button>');assert.equal(audit(root).result,'BLOCK_NAVIGATION_CHANGED');write('index.html',nav())});
 test('public data path change is blocked before cutover',()=>{write('app.js','fetch("/api/new")');assert.equal(audit(root).result,'BLOCK_LEGACY_DATA_PATH_CHANGED')});
 test('static audit never authorizes a private release',()=>{write('app.js','fetch(URL+"/rest/v1/x")');assert.equal(audit(root).cutover_ready,false);assert.ok(audit(root).remote_verifications.length>=5)});
}finally{fs.rmSync(root,{recursive:true,force:true})}
console.log('5 synthetic preflight scenarios PASS');
