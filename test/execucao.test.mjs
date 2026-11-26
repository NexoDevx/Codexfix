// node --test test/execucao.test.mjs — carrega modulos/execucao.js com um "app" falso e roda os scripts gerados num shell local.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
const SRC=fs.readFileSync('modulos/execucao.js','utf8');
function app(files,{real=true,mode='auto'}={}){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cmx-')),proj=path.join(tmp,'proj'),home=path.join(tmp,'home');fs.mkdirSync(proj);fs.mkdirSync(home);
 const calls=[],pjo={files:{...files},termCwd:''};
 const shellRun=async(script,to)=>{calls.push(script);
  if(/-m pip install|npm install|apk add|pkg install/.test(script))return{out:'(instalação bloqueada no teste: não baixa pacotes de verdade)',code:1};for(const[k,v]of Object.entries(pjo.files)){const f=path.join(proj,k);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v)}
  const r=spawnSync('sh',['-c',script],{cwd:proj,env:{...process.env,HOME:home,TMPDIR:tmp,PIP_RETRIES:'0',PIP_TIMEOUT:'3'},encoding:'utf8',timeout:Math.min((to||60)*1000,90000)});
  return{out:(r.stdout||'')+(r.stderr||''),code:r.status??1,to:r.error&&r.error.code==='ETIMEDOUT'}};
 const ctx={window:{},S:{mode,cur:'teste'},pj:()=>pjo,real:()=>real,shellRun,dlg:async()=>0,console};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(SRC,ctx);
 return{X:ctx.window.CodeMobileExec||ctx.CodeMobileExec,calls,pjo,tmp};
}
const have=b=>spawnSync('sh',['-c','command -v '+b]).status===0;

test('tabela: extensões únicas, campos obrigatórios e ≥ 25 linguagens',()=>{
 const{X}=app({});const ids=Object.keys(X.RT);assert.ok(ids.length>=25,'só '+ids.length);
 const seen={};for(const[id,rt]of Object.entries(X.RT)){assert.ok(rt.n&&rt.ext.length&&rt.bin.length&&typeof rt.run==='function',id);assert.ok(rt.apk||rt.tx,id+' sem pacote');for(const e of rt.ext){assert.ok(!seen[e],'extensão repetida .'+e);seen[e]=id}}
 assert.equal(X.rtFor('src/main.rs').id,'rust');assert.equal(X.rtFor('a/b/App.KT').id,'kotlin');assert.equal(X.rtFor('x.unknown'),null);assert.equal(X.rtById('py').id,'python');assert.equal(X.rtById('dotnet').id,'csharp');
});
test('todo script gerado tem sintaxe de shell válida (sh -n), inclusive com aspas e espaços no nome',()=>{
 const files={'pom.xml':'<p/>','go.mod':'module x\n','Cargo.toml':'[package]','Gemfile':'source "x"','composer.json':'{}','mix.exs':'x','requirements.txt':'numpy\nrequests==2\n','package.json':'{}'};
 const{X}=app(files);let n=0;
 for(const rt of Object.values(X.RT)){const p="dir com espaço/it's "+rt.id+'.'+rt.ext[0];const f={...files,[p]:'int main(){}'};
  const c=X.ctxOf(p,f),scripts=[X.buildRun(rt,p,f,"entrada 'x'\nlinha2"),X.buildRun(rt,p,f,''),X.probeScript(X.reqsOf(rt,c))];
  for(const st of (rt.steps?rt.steps(c):[]))scripts.push(X.stepScript(c,rt,st));
  for(const r of X.reqsOf(rt,c)){for(const pm of['apk','pkg']){const s=X.installScript(Object.assign({id:rt.id},r),pm);if(s)scripts.push(s)}}
  for(const s of scripts){const r=spawnSync('sh',['-n','-c',s],{encoding:'utf8'});assert.equal(r.status,0,rt.id+': '+r.stderr+'\n'+s);n++}}
 assert.ok(n>100);
});
test('python: roda de verdade, passa stdin e acha módulos do próprio projeto',{skip:!have('python3')},async()=>{
 const{X}=app({'main.py':'import util\nprint(util.dobro(int(input())))\n','util.py':'def dobro(x): return x*2\n'});
 const a=app({'main.py':'import util\nprint(util.dobro(int(input())))\n','util.py':'def dobro(x): return x*2\n'});
 const r=await a.X.runReal('main.py','21');assert.equal(r.ok,true,r.out);assert.match(r.out,/42/);
});
test('python: erro do programa vira ok=false com código e traceback',{skip:!have('python3')},async()=>{
 const a=app({'e.py':'print("antes")\nraise ValueError("boom")\n'});const r=await a.X.runReal('e.py','');assert.equal(r.ok,false);assert.match(r.out,/boom/);assert.notEqual(r.code,0)});
test('python: import ausente → tenta instalar o pacote certo (cv2 → opencv-python-headless) e para sem loop quando o pip falha',{skip:!have('python3')},async()=>{
 const a=app({'m.py':'import zzz_pacote_inexistente_cm\n'});const r=await a.X.runReal('m.py','');assert.equal(r.ok,false);
 const inst=a.calls.filter(s=>/pip install -q 'zzz_pacote_inexistente_cm'/.test(s));assert.equal(inst.length,1,'deve tentar 1 vez só');assert.match(r.out,/instalando zzz_pacote_inexistente_cm/);assert.match(r.out,/não consegui instalar/);
 assert.equal(a.X.RT.python.miss("ModuleNotFoundError: No module named 'cv2'",{files:{}}).name,'opencv-python-headless');
 assert.equal(a.X.RT.python.miss("ModuleNotFoundError: No module named 'util'",{files:{'util.py':''}}),null,'módulo local não é instalado');
 assert.equal(a.X.RT.python.miss("ModuleNotFoundError: No module named 'yaml.x'",{files:{}}).name,'pyyaml');
});
test('python: requirements.txt só instala de novo quando muda (carimbo)',{skip:!have('python3')},async()=>{
 const a=app({'m.py':'print(1)\n','requirements.txt':'# nada\n'});const x=a.X.RT.python,c=a.X.ctxOf('m.py',a.pjo.files);
 const st=x.steps(c)[0];assert.equal(st.label,'pip install -r requirements.txt');
 const h1=st.hash;a.pjo.files['requirements.txt']='# nada\n# mudou\n';assert.notEqual(x.steps(a.X.ctxOf('m.py',a.pjo.files))[0].hash,h1);
 assert.deepEqual(JSON.parse(JSON.stringify(a.X.parseReq('numpy>=1.2 # c\n-r outro.txt\n# x\nRequests[security]==2\nmy_pkg\n'))),['numpy','requests','my-pkg']);
});
test('node: roda, usa require e instala dependência ausente quando o erro é Cannot find module',{skip:!have('node')},async()=>{
 const a=app({'a.js':'console.log([1,2,3].map(x=>x*2).join(","))'});const r=await a.X.runReal('a.js','');assert.equal(r.ok,true,r.out);assert.match(r.out,/2,4,6/);
 const n=a.X.RT.node.miss("Error: Cannot find module 'lodash/fp'\n",{files:{}});assert.deepEqual([n.name,n.kind],['lodash','npm']);
 assert.equal(a.X.RT.node.miss("Cannot find module './local'",{files:{}}),null);assert.equal(a.X.RT.node.miss("Cannot find module 'node:fs'",{files:{}}),null);
 assert.equal(a.X.RT.node.miss("Cannot find package '@scope/pkg/sub' imported",{files:{}}).name,'@scope/pkg');
});
test('c e c++: compilam e executam; vários .c na mesma pasta entram juntos; erro de compilação aparece',{skip:!have('gcc')||!have('g++')},async()=>{
 const a=app({'main.c':'#include <stdio.h>\nint soma(int,int);\nint main(){printf("%d\\n",soma(2,3));return 0;}','soma.c':'int soma(int a,int b){return a+b;}','x.cpp':'#include <iostream>\nint main(){int n;std::cin>>n;std::cout<<n*n<<"\\n";}','bad.c':'int main(){ return x; }'});
 let r=await a.X.runReal('main.c','');assert.equal(r.ok,true,r.out);assert.match(r.out,/^5$/m);
 r=await a.X.runReal('x.cpp','7');assert.equal(r.ok,true,r.out);assert.match(r.out,/49/);
 r=await a.X.runReal('bad.c','');assert.equal(r.ok,false);assert.match(r.out,/error/i);
});
test('perl e bash',{skip:!have('perl')||!have('bash')},async()=>{
 const a=app({'a.pl':'print "oi perl\\n";','a.sh':'echo oi $((1+2))'});
 assert.match((await a.X.runReal('a.pl','')).out,/oi perl/);assert.match((await a.X.runReal('a.sh','')).out,/oi 3/);
});
test('ferramenta ausente e sem gerenciador de pacotes: mensagem clara, nada de loop',{skip:have('ruby')},async()=>{
 const a=app({'a.rb':'puts 1'});const r=await a.X.runReal('a.rb','');assert.equal(r.ok,false);assert.match(r.out,/gerenciador de pacotes/);
});
test('sem Linux real, modo plano ou arquivo desconhecido → null (cai nos caminhos antigos)',async()=>{
 assert.equal(await app({'a.py':'1'},{real:false}).X.runReal('a.py',''),null);
 assert.equal(await app({'a.py':'1'},{mode:'plan'}).X.runReal('a.py',''),null);
 assert.equal(await app({'a.xyz':'1'}).X.runReal('a.xyz',''),null);
});
test('java: descobre pacote, raiz de fontes e classe principal; maven/gradle detectados',()=>{
 const a=app({});const X=a.X;
 const f={'src/main/java/com/x/App.java':'package com.x;\npublic class App{}'};
 assert.deepEqual(JSON.parse(JSON.stringify(X.javaInfo(X.ctxOf('src/main/java/com/x/App.java',f)))),{root:'src/main/java',fq:'com.x.App'});
 assert.deepEqual(JSON.parse(JSON.stringify(X.javaInfo(X.ctxOf('Main.java',{'Main.java':'class Main{}'})))),{root:'.',fq:'Main'});
 assert.match(X.buildRun(X.RT.java,'Main.java',{'Main.java':'x','pom.xml':'x'},''),/mvn -q -B -DskipTests compile/);
 assert.match(X.buildRun(X.RT.java,'Main.java',{'Main.java':'x','build.gradle':'x'},''),/gradlew/);
 assert.match(X.buildRun(X.RT.java,'Main.java',{'Main.java':'x'},''),/javac .*-sourcepath/);
});
test('go/rust escolhem o comando certo conforme go.mod / Cargo.toml',()=>{
 const{X}=app({});
 assert.match(X.buildRun(X.RT.go,'cmd/app/main.go',{'go.mod':'x','cmd/app/main.go':'x'},''),/go run \.\/cmd\/app/);
 assert.match(X.buildRun(X.RT.go,'main.go',{'go.mod':'x','main.go':'x'},''),/go run \.\n/);
 assert.match(X.buildRun(X.RT.go,'main.go',{'main.go':'x'},''),/go run 'main\.go'/);
 assert.match(X.buildRun(X.RT.rust,'src/bin/tool.rs',{'Cargo.toml':'x'},''),/cargo run -q --bin 'tool'/);
 assert.match(X.buildRun(X.RT.rust,'a.rs',{'a.rs':'x'},''),/rustc -O 'a\.rs'/);
});
test('o módulo não quebra quando carregado dentro do app de verdade (index.html)',()=>{
 const h=fs.readFileSync('www/index.html','utf8');assert.match(h,/<!-- cm-modulo:execucao -->/);assert.match(h,/<!-- cm-modulo:modelos -->/);
 assert.ok(h.indexOf('cm-modulo:execucao')>h.indexOf('provedores.js'),'tem que carregar depois dos provedores');
});
