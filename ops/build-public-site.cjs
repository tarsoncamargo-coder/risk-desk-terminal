'use strict';
// Publish only reviewed, browser-facing files; never upload the repository root.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.site-dist');
const publicExtensions = new Set(['.html','.css','.js','.json','.svg','.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2','.txt','.csv']);
const publicDirs = new Set(['assets','images','img','fonts','static','data']);
const deny = /(^|\/)(\.|node_modules|tests|ops|collector|pipeline|scripts|supabase|migrations|backup|backups)(\/|$)|\.map$|secret|credential|token|\.env/i;
const tracked = cp.execFileSync('git',['ls-files','-z'],{cwd:root}).toString('utf8').split('\0').filter(Boolean);
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});
let count = 0;
for(const name of tracked){
  const normalized=name.replace(/\\/g,'/');
  const bits=normalized.split('/');
  if(deny.test(normalized))continue;
  if(bits.length>1 && !publicDirs.has(bits[0]))continue;
  if(!publicExtensions.has(path.extname(normalized).toLowerCase()))continue;
  const source=path.resolve(root,normalized);
  if(!source.startsWith(root+path.sep) || !fs.statSync(source).isFile())continue;
  const target=path.join(out,normalized);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.copyFileSync(source,target);
  count++;
}
for(const required of ['index.html','app.js','styles.css']){
 if(!fs.existsSync(path.join(out,required)))throw Error('Required frontend file missing: '+required);
}
for(const forbidden of ['.github','collector','pipeline','ops','tests','.env']){
 if(fs.existsSync(path.join(out,forbidden)))throw Error('Private path included: '+forbidden);
}
console.log('Safe static site assembled:',count,'public files');
