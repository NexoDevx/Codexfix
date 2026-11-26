/* ===== modelos.js: tela "🆓 Modelos grátis" (OpenRouter ao vivo + provedores com plano grátis) ===== */
(()=>{
'use strict';
const G=typeof globalThis!=='undefined'?globalThis:window;
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:NaN},has=(a,x)=>Array.isArray(a)&&a.includes(x);
/* mesma regra de scripts/modelos-gratis.mjs (o teste compara as duas) */
function normalize(j,now=new Date()){
 const arr=Array.isArray(j)?j:(j&&Array.isArray(j.data)?j.data:[]),models=[];
 for(const m of arr){
  const id=String((m&&m.id)||'');if(!id)continue;
  const pr=m.pricing||{},free=(num(pr.prompt)===0&&num(pr.completion)===0)||(/:free$/.test(id)&&pr.prompt==null);
  if(!free)continue;
  const a=m.architecture||{},outm=a.output_modalities,inm=a.input_modalities,sp=m.supported_parameters;
  if(Array.isArray(outm)&&!outm.includes('text'))continue;
  models.push({id,name:String(m.name||id),ctx:Number(m.context_length||(m.top_provider&&m.top_provider.context_length)||0)||0,
   tools:has(sp,'tools'),vision:has(inm,'image'),reasoning:has(sp,'reasoning')||has(sp,'include_reasoning'),created:Number(m.created)||0});
 }
 models.sort((x,y)=>y.created-x.created||x.id.localeCompare(y.id));
 return{updated:now.toISOString(),source:'openrouter',count:models.length,models};
}
const view=(models,f)=>{const q=String(f.q||'').toLowerCase().trim();
 let o=models.filter(m=>(!q||(m.id+' '+m.name).toLowerCase().includes(q))&&(!f.tools||m.tools)&&(!f.vision||m.vision)&&(!f.reason||m.reasoning));
 if(f.sort==='ctx')o=[...o].sort((a,b)=>b.ctx-a.ctx||a.id.localeCompare(b.id));return o};
G.CodeMobileModelos={normalize,view};
if(typeof document==='undefined'||typeof cmMenu==='undefined'||typeof S==='undefined')return;

const FM={tab:'or',q:'',tools:true,vision:false,reason:false,sort:'new',data:null,src:'',err:'',busy:0,msg:'',vis:[]};
const E=s=>typeof esc==='function'?esc(s):String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ctxK=n=>!n?'?':n>=1e6?(n/1e6).toFixed(n%1e6?1:0)+'M':Math.round(n/1000)+'k';
const when=iso=>{if(!iso)return'';const d=new Date(iso);return isNaN(d)?'':d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})};
const box=()=>{let d=document.getElementById('fm');if(!d){d=document.createElement('div');d.id='fm';
 d.style.cssText='position:fixed;inset:0;z-index:9000;background:var(--bg);color:var(--t);display:flex;flex-direction:column;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';document.body.appendChild(d)}return d};
const chip=(on,fn,t)=>'<span class="ch" style="'+(on?'border-color:var(--a);color:var(--a)':'')+'" onclick="'+fn+'">'+t+'</span>';

async function pull(){
 const tries=[];
 if(typeof CM_SRV!=='undefined'&&CM_SRV&&typeof cmApi==='function')tries.push(['servidor',()=>cmApi('models/free'+(FM.force?'?refresh=1':''))]);
 tries.push(['OpenRouter (ao vivo)',async()=>{const r=await fetch('https://openrouter.ai/api/v1/models',{headers:{accept:'application/json'}});if(!r.ok)throw new Error('OpenRouter '+r.status);return normalize(await r.json())}]);
 tries.push(['cópia salva no app',async()=>{const r=await fetch('free-models.json',{cache:'no-store'});if(!r.ok)throw new Error('sem cópia');return r.json()}]);
 const errs=[];
 for(const[n,fn]of tries){try{const j=await fn();if(j&&Array.isArray(j.models)&&j.models.length){FM.data=j;FM.src=n==='servidor'&&j.source?'servidor ('+j.source+')':n;return}errs.push(n+': lista vazia')}catch(e){errs.push(n+': '+(e&&e.message||e))}}
 throw new Error(errs.join(' · '));
}
async function load(force){FM.busy=1;FM.err='';FM.force=!!force;paint();try{await pull()}catch(e){FM.err='Não consegui carregar os modelos. '+e.message}FM.busy=0;paint()}

function head(){return'<div class="r" style="padding:10px 12px;align-items:center"><b style="flex:1;font-size:17px">🆓 Modelos grátis</b><button class="s" onclick="FMUI.reload()" title="Atualizar">↻</button><button class="s" onclick="FMUI.close()">✕</button></div>'
 +'<div class="r" style="padding:0 12px 6px"><button class="s'+(FM.tab==='or'?' on':'')+'" style="flex:1" onclick="FMUI.tab(\'or\')">OpenRouter · ao vivo</button><button class="s'+(FM.tab==='pv'?' on':'')+'" style="flex:1" onclick="FMUI.tab(\'pv\')">Outros provedores</button></div>'}
function orBody(){
 const d=FM.data;
 let h='<div style="padding:0 12px"><input id="fmq" placeholder="Buscar modelo (ex.: llama, qwen, deepseek)" value="'+E(FM.q)+'" oninput="FMUI.q(this.value)" style="width:100%;box-sizing:border-box">'
 +'<div class="r" style="margin:6px 0">'+chip(FM.tools,'FMUI.f(\'tools\')','🛠 com ferramentas')+chip(FM.vision,'FMUI.f(\'vision\')','👁 imagens')+chip(FM.reason,'FMUI.f(\'reason\')','🧠 raciocínio')+chip(FM.sort==='ctx','FMUI.f(\'sort\')','↕ maior contexto')+'</div>'
 +'<small style="color:var(--m)">O agente do CodeMobile precisa de chamadas de ferramenta: deixe 🛠 ligado. Modelos grátis têm limite de uso e podem sair do ar. O OpenRouter pede uma chave (grátis) mesmo para modelos sem custo.</small>'
 +(d?'<br><small style="color:var(--m)">Fonte: '+E(FM.src)+(d.updated?' · atualizado '+E(when(d.updated)):'')+' · '+d.models.length+' modelos grátis</small>':'')+'</div>'
 +'<div id="fml" style="flex:1;overflow:auto;padding:8px 12px 16px">'+list()+'</div>';return h}
function list(){
 if(FM.busy)return'<div class="f">⏳ Carregando…</div>';
 if(FM.err)return'<div class="f">❌ '+E(FM.err)+'<div class="r" style="margin-top:6px"><button class="s" onclick="FMUI.reload()">Tentar de novo</button></div></div>';
 if(!FM.data)return'';
 FM.vis=view(FM.data.models,FM).slice(0,200);
 const ok=FM.msg?'<div class="f" style="border-color:var(--g)">'+FM.msg+'</div>':'';
 if(!FM.vis.length)return ok+'<div class="f">Nenhum modelo com esses filtros. Desligue 🛠 para ver todos.</div>';
 const cur=S.model&&S.model.openrouter;
 return ok+FM.vis.map((m,i)=>'<div class="f" style="margin-bottom:8px"><b>'+E(m.name)+'</b>'+(m.id===cur&&S.prov==='openrouter'?' <span style="color:var(--g)">✓ em uso</span>':'')+'<br><small style="color:var(--m);word-break:break-all">'+E(m.id)+'</small><br>'
  +'<small>📏 '+ctxK(m.ctx)+' tokens'+(m.tools?' · 🛠 ferramentas':' · sem ferramentas')+(m.vision?' · 👁 imagens':'')+(m.reasoning?' · 🧠 raciocínio':'')+'</small>'
  +'<div class="r" style="margin-top:6px"><button class="s" onclick="FMUI.use('+i+')">Usar este modelo</button></div></div>').join('')}
function pvBody(){
 const ks=Object.keys(P).filter(k=>(P[k].tabs||[]).includes('free')||P[k].nokey);
 return'<div style="flex:1;overflow:auto;padding:4px 12px 16px">'+(FM.msg?'<div class="f" style="border-color:var(--g);margin-bottom:8px">'+FM.msg+'</div>':'')
 +'<small style="color:var(--m)">Provedores com plano grátis ou sem cadastro. Toque em Usar, cole a chave em Ajustes e carregue os modelos. Os limites mudam; confira na página de cada um.</small>'
 +ks.map(k=>'<div class="f" style="margin:8px 0"><b>'+E(P[k].n)+'</b>'+(S.keys[k]&&!P[k].nokey?' <span style="color:var(--g)">✓ chave salva</span>':'')+(P[k].nokey?' <span style="color:var(--g)">sem chave</span>':'')+(S.prov===k?' <span style="color:var(--a)">● ativo</span>':'')
  +'<br><small style="color:var(--m)">'+E(P[k].note||'')+'</small><div class="r" style="margin-top:6px"><button class="s" onclick="FMUI.prov(\''+k+'\')">Usar</button>'+(P[k].link?'<button class="s" onclick="FMUI.open_(\''+k+'\')">'+(P[k].nokey?'🔗 Site':'🔑 Obter chave')+'</button>':'')+'</div></div>').join('')+'</div>'}
function paint(){const b=box();b.innerHTML=head()+(FM.tab==='or'?orBody():pvBody());if(FM.tab==='or'&&FM.q){const i=document.getElementById('fmq');if(i&&document.activeElement!==i){}}}
function paintList(){const l=document.getElementById('fml');if(l)l.innerHTML=list()}

const FMUI=G.FMUI={
 async open(){FM.msg='';box();if(!FM.data&&!FM.busy)await load(false);else paint()},
 close(){const d=document.getElementById('fm');if(d)d.remove()},
 reload(){load(true)},
 tab(t){FM.tab=t;FM.msg='';paint()},
 q(v){FM.q=v;paintList()},
 f(k){if(k==='sort')FM.sort=FM.sort==='ctx'?'new':'ctx';else FM[k]=!FM[k];FM.msg='';paint()},
 use(i){const m=FM.vis[i];if(!m)return;
  S.models=S.models||{};S.model=S.model||{};const l=S.models.openrouter=S.models.openrouter||[];if(!l.includes(m.id)){l.push(m.id);l.sort()}
  S.prov='openrouter';S.model.openrouter=m.id;try{save()}catch(e){}try{if(typeof cfgR==='function'&&document.getElementById('cfg'))cfgR()}catch(e){}try{if(typeof ui==='function')ui()}catch(e){}
  FM.msg='✅ <b>'+E(m.name)+'</b> ficou como modelo do OpenRouter.'+(S.keys&&S.keys.openrouter?'':'<br>Falta a chave do OpenRouter: toque em “Outros provedores” → OpenRouter → Obter chave, e cole em Ajustes.');paint()},
 prov(k){if(typeof CMP!=='undefined'&&CMP.pick)CMP.pick(k);else{S.prov=k;try{save()}catch(e){}}try{if(typeof ui==='function')ui()}catch(e){}
  FM.msg='✅ Provedor: <b>'+E(P[k].n)+'</b>.'+(P[k].nokey||(S.keys&&S.keys[k])?' Abra Ajustes → Buscar modelos para escolher o modelo.':' Falta a chave: toque em “Obter chave” e cole em Ajustes.');paint()},
 open_(k){if(typeof ghOpen==='function')ghOpen(P[k].link)}
};
try{const _m=cmMenu;cmMenu=function(){return[..._m(),['🆓','Modelos grátis','Ver modelos gratuitos e usar com um toque',()=>FMUI.open()]]}}catch(e){}
try{const _g=go;go=function(v){if(/^\/(gratis|grátis|modelos)\s*$/i.test(String(v||'').trim())){FMUI.open();return}return _g(v)}}catch(e){}
})();
