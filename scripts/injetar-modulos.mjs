// node scripts/injetar-modulos.mjs [--check]
// Coloca os arquivos de modulos/*.js dentro do www/index.html (blocos <script> entre marcadores) e copia para o projeto Android.
// --check: não grava; sai com erro se o index.html estiver diferente do que a injeção produziria (usado nos testes/CI).
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..'),ORDEM=['execucao','modelos'],check=process.argv.includes('--check');
const alvos=['www/index.html','android/app/src/main/assets/public/index.html'].map(p=>path.join(root,p)).filter(p=>fs.existsSync(p));
let bad=0;
for(const alvo of alvos){
 let h=fs.readFileSync(alvo,'utf8');const orig=h;
 for(const n of ORDEM){
  const f=path.join(root,'modulos',n+'.js');if(!fs.existsSync(f))continue;const js=fs.readFileSync(f,'utf8');
  if(/<\/script/i.test(js))throw new Error(n+'.js contém "</script": quebraria o HTML');
  const A='<!-- cm-modulo:'+n+' -->',B='<!-- /cm-modulo:'+n+' -->',bloco=A+'\n<script>\n'+js.replace(/\n$/,'')+'\n</script>\n'+B+'\n';
  const i=h.indexOf(A),j=h.indexOf(B);
  if(i>=0&&j>i)h=h.slice(0,i)+bloco+h.slice(j+B.length+1);
  else{const k=h.lastIndexOf('</body>');if(k<0)throw new Error('sem </body> em '+alvo);h=h.slice(0,k)+bloco+h.slice(k)}
 }
 if(h!==orig){if(check){console.error('Desatualizado: '+path.relative(root,alvo)+' (rode: node scripts/injetar-modulos.mjs)');bad=1}else{fs.writeFileSync(alvo,h);console.log('Atualizado '+path.relative(root,alvo))}}
 else console.log('Em dia: '+path.relative(root,alvo));
}
process.exit(bad);
