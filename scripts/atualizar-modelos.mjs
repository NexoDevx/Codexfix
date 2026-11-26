// node scripts/atualizar-modelos.mjs  — baixa a lista de modelos grátis e grava www/free-models.json (só se mudou).
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {fetchFree} from './modelos-gratis.mjs';
const out=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','www','free-models.json');
const strip=o=>JSON.stringify({...o,updated:0});
let novo;try{novo=await fetchFree()}catch(e){console.error('Falha ao baixar a lista:',e.message);process.exit(1)}
if(!novo.models.length){console.error('A lista veio vazia; mantendo o arquivo atual.');process.exit(1)}
let velho=null;try{velho=JSON.parse(fs.readFileSync(out,'utf8'))}catch{}
if(velho&&strip(velho)===strip(novo)){console.log('Sem mudanças ('+novo.count+' modelos grátis).');process.exit(0)}
fs.writeFileSync(out,JSON.stringify(novo,null,1)+'\n');console.log('Atualizado: '+novo.count+' modelos grátis.');
