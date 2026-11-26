// node --test test/modelos.test.mjs — modelos grátis (lib, tela, rota do servidor) e consistência do index.html
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import http from 'node:http';import {spawn,spawnSync} from 'node:child_process';
import {normalize} from '../scripts/modelos-gratis.mjs';
/* dados SINTÉTICOS no formato da API do OpenRouter (não são modelos reais) */
const FIX={data:[
 {id:'acme/alfa:free',name:'Alfa (free)',created:300,context_length:131072,pricing:{prompt:'0',completion:'0'},architecture:{input_modalities:['text','image'],output_modalities:['text']},supported_parameters:['tools','reasoning','temperature']},
 {id:'acme/beta:free',name:'Beta (free)',created:200,context_length:8192,pricing:{prompt:'0',completion:'0'},architecture:{input_modalities:['text'],output_modalities:['text']},supported_parameters:['temperature']},
 {id:'acme/pago',name:'Pago',created:400,context_length:1000,pricing:{prompt:'0.000001',completion:'0.000002'},architecture:{output_modalities:['text']},supported_parameters:['tools']},
 {id:'acme/roteador',name:'Roteador',created:500,context_length:1000,pricing:{prompt:'-1',completion:'-1'}},
 {id:'acme/imagem:free',name:'Só imagem',created:600,pricing:{prompt:'0',completion:'0'},architecture:{output_modalities:['image']}},
 {id:'acme/sempreco:free',name:'Sem preço informado',created:100,top_provider:{context_length:4096}},
 {name:'sem id'}]};
test('normalize: só grátis, só texto, flags e ordem (mais novo primeiro)',()=>{
 const r=normalize(FIX,new Date('2026-01-01T00:00:00Z'));assert.deepEqual(r.models.map(m=>m.id),['acme/alfa:free','acme/beta:free','acme/sempreco:free']);
 assert.equal(r.count,3);assert.equal(r.updated,'2026-01-01T00:00:00.000Z');
 const a=r.models[0];assert.deepEqual([a.tools,a.vision,a.reasoning,a.ctx],[true,true,true,131072]);assert.equal(r.models[1].tools,false);assert.equal(r.models[2].ctx,4096);
 assert.deepEqual(normalize(null).models,[]);assert.deepEqual(normalize({data:'x'}).models,[]);
});
test('a tela (modulos/modelos.js) normaliza exatamente como o servidor/workflow e filtra/ordena',()=>{
 const ctx={window:{}};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('modulos/modelos.js','utf8'),ctx);const M=ctx.window.CodeMobileModelos||ctx.CodeMobileModelos;
 const now=new Date('2026-01-01T00:00:00Z');assert.equal(JSON.stringify(M.normalize(FIX,now)),JSON.stringify(normalize(FIX,now)));
 const ms=normalize(FIX).models,ids=f=>Array.from(M.view(ms,f).map(m=>m.id));
 assert.deepEqual(ids({tools:true}),['acme/alfa:free']);assert.deepEqual(ids({q:'BETA'}),['acme/beta:free']);assert.deepEqual(ids({vision:true}),['acme/alfa:free']);assert.deepEqual(ids({sort:'ctx'}),['acme/alfa:free','acme/beta:free','acme/sempreco:free']);
});
test('servidor: /api/models/free — ao vivo, cache em memória e cache em disco sem internet',async()=>{
 const fake=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'application/json'});s.end(JSON.stringify(FIX))});await new Promise(r=>fake.listen(0,'127.0.0.1',r));
 const fp=fake.address().port,port=8800+Math.floor(Math.random()*90),DATA=fs.mkdtempSync(path.join(os.tmpdir(),'cmf-'));
 const srv=spawn('node',['server.mjs'],{env:{...process.env,PORT:port,CM_DATA:DATA,CM_MODELS_URL:'http://127.0.0.1:'+fp+'/models'},stdio:['ignore','pipe','ignore']});let out='';srv.stdout.on('data',d=>out+=d);
 try{for(let i=0;i<60&&!/Token de acesso/.test(out);i++)await new Promise(r=>setTimeout(r,100));
  const tok=/Token de acesso[^:]*: (\w+)/.exec(out)[1],B='http://127.0.0.1:'+port+'/api/models/free',H={authorization:'Bearer '+tok};
  assert.equal((await fetch(B)).status,401);assert.equal((await fetch(B,{method:'POST',headers:H})).status,405);
  let j=await (await fetch(B,{headers:H})).json();assert.equal(j.via,'ao vivo');assert.equal(j.count,3);assert.equal(j.models[0].id,'acme/alfa:free');
  j=await (await fetch(B,{headers:H})).json();assert.equal(j.via,'cache (memória)');
  await new Promise(r=>fake.close(r));
  j=await (await fetch(B+'?refresh=1',{headers:H})).json();assert.match(j.via,/disco/);assert.equal(j.count,3);
  assert.ok(fs.existsSync(path.join(DATA,'free-models.json')));
 }finally{srv.kill();fake.close()}
});
test('atualizador: não grava lista vazia e não reescreve quando nada mudou',async()=>{
 const fake=http.createServer((q,s)=>{s.writeHead(200,{'content-type':'application/json'});s.end(JSON.stringify(q.url.includes('vazio')?{data:[]}:FIX))});await new Promise(r=>fake.listen(0,'127.0.0.1',r));const fp=fake.address().port;
 const bak=fs.readFileSync('www/free-models.json','utf8');
 try{const run=u=>new Promise(res=>{const c=spawn('node',['scripts/atualizar-modelos.mjs'],{env:{...process.env,CM_MODELS_URL:'http://127.0.0.1:'+fp+u}});let o='',e='';c.stdout.on('data',d=>o+=d);c.stderr.on('data',d=>e+=d);c.on('close',st=>res({status:st,stdout:o,stderr:e}))});
  let r=await run('/vazio');assert.equal(r.status,1);assert.match(r.stderr,/vazia/);assert.equal(fs.readFileSync('www/free-models.json','utf8'),bak);
  r=await run('/models');assert.equal(r.status,0,r.stderr);const a=JSON.parse(fs.readFileSync('www/free-models.json','utf8'));assert.equal(a.count,3);
  const t1=fs.readFileSync('www/free-models.json','utf8');await new Promise(r=>setTimeout(r,1100));r=await run('/models');assert.match(r.stdout,/Sem mudanças/);assert.equal(fs.readFileSync('www/free-models.json','utf8'),t1,'só o carimbo de data mudou: não reescreve');
 }finally{fs.writeFileSync('www/free-models.json',bak);fake.close()}
});
test('index.html: módulos em dia, todos os <script> compilam e o worker do Python compila',()=>{
 assert.equal(spawnSync('node',['scripts/injetar-modulos.mjs','--check'],{encoding:'utf8'}).status,0);
 for(const f of['www/index.html','android/app/src/main/assets/public/index.html']){const h=fs.readFileSync(f,'utf8');let n=0;
  for(const m of h.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)){new vm.Script(m[1],{filename:f+'#'+(++n)})}assert.ok(n>20,f+': '+n)}
 const ctx={window:{}};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('modulos/execucao.js','utf8'),ctx);new vm.Script((ctx.window.CodeMobileExec||ctx.CodeMobileExec).PYW2);
 assert.equal(fs.readFileSync('www/index.html','utf8'),fs.readFileSync('android/app/src/main/assets/public/index.html','utf8'),'www e android/assets devem ser iguais');
});
