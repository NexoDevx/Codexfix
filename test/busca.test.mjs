import test from 'node:test';import assert from 'node:assert';import {spawn} from 'node:child_process';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
test('/api/search: exige token e responde JSON com results (sem CORS, feito pelo servidor)', async()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'cmb-')),port=8700+Math.floor(Math.random()*90),c=spawn('node',['server.mjs'],{env:{...process.env,CM_DATA:d,PORT:port},stdio:['ignore','pipe','ignore']});
 let out='';c.stdout.on('data',x=>out+=x);try{
  for(let i=0;i<40&&!/Token/.test(out);i++)await new Promise(r=>setTimeout(r,100));
  const tok=out.split('Token')[1].split(': ').pop().trim(),B='http://localhost:'+port;
  assert.equal((await fetch(B+'/api/search?q=teste')).status,401);
  const H={Authorization:'Bearer '+tok};
  assert.equal((await fetch(B+'/api/search',{headers:H})).status,500);            // sem q
  const r=await fetch(B+'/api/search?q=node.js',{headers:H});assert.equal(r.status,200);
  const j=await r.json();assert.ok(Array.isArray(j.results));assert.ok(Array.isArray(j.errors));
  const caps=await (await fetch(B+'/api/caps',{headers:H})).json();assert.ok(Array.isArray(caps.tools));
 }finally{c.kill()}});
test('index.html: busca passa pelo servidor/HTTP nativo antes do fetch direto', ()=>{
 const h=fs.readFileSync('www/index.html','utf8');
 assert.match(h,/cmApi\('search\?q='/);assert.match(h,/CapacitorHttp/);assert.match(h,/src="\/cm-config\.js"/);
 const gt=h.slice(h.indexOf('async function gt(u)'),h.indexOf('async function gt(u)')+900);
 assert.ok(gt.indexOf("cmApi('fetch")<gt.indexOf('CapacitorHttp')&&gt.indexOf('CapacitorHttp')<gt.indexOf('await fetch(u'));});
