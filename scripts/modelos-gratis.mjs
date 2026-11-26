// Lista de modelos gratuitos (OpenRouter, API pública sem chave). Usado pelo servidor (/api/models/free)
// e pelo workflow "Atualizar modelos grátis". A mesma regra de normalização existe em modulos/modelos.js (o teste compara as duas).
export const URL_OPENROUTER=(globalThis.process&&process.env.CM_MODELS_URL)||'https://openrouter.ai/api/v1/models'; // CM_MODELS_URL: espelho/teste
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:NaN};
const has=(a,x)=>Array.isArray(a)&&a.includes(x);
export function normalize(j,now=new Date()){
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
export async function fetchFree(f=globalThis.fetch,ms=20000){
 const r=await f(URL_OPENROUTER,{headers:{accept:'application/json'},signal:AbortSignal.timeout(ms)});
 if(!r.ok)throw new Error('OpenRouter respondeu '+r.status);
 return normalize(await r.json());
}
