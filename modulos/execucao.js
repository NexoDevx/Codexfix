/* ===== execucao.js: execução REAL de ~25 linguagens + instalação automática de compiladores e dependências ===== */
(()=>{
'use strict';
const G=typeof globalThis!=='undefined'?globalThis:window;
const Q=s=>"'"+String(s).replace(/'/g,"'\\''")+"'";
const hash=v=>{v=String(v);let a=2166136261,b=0x9e3779b9;for(let i=0;i<v.length;i++){const c=v.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,2246822519)}return v.length+'-'+(a>>>0).toString(16)+(b>>>0).toString(16)};
const dirOf=p=>{const i=p.lastIndexOf('/');return i<0?'':p.slice(0,i)};
const baseOf=p=>p.slice(p.lastIndexOf('/')+1);
const stem=p=>baseOf(p).replace(/\.[^.]+$/,'');
const okName=n=>/^[A-Za-z0-9@][\w.@\/+-]{0,120}$/.test(n)&&!/\.\./.test(n);
const slugOf=()=>String((typeof S!=='undefined'&&S.cur)||'p').replace(/[^\w.-]+/g,'_').slice(0,40)||'p';

/* ---------- nomes de import que não são o nome do pacote no PyPI ---------- */
const PYMAP={cv2:'opencv-python-headless',PIL:'pillow',yaml:'pyyaml',sklearn:'scikit-learn',bs4:'beautifulsoup4',dotenv:'python-dotenv',dateutil:'python-dateutil',serial:'pyserial',Crypto:'pycryptodome',jwt:'pyjwt',magic:'python-magic',skimage:'scikit-image',docx:'python-docx',pptx:'python-pptx',fitz:'pymupdf',OpenSSL:'pyopenssl',git:'gitpython',telegram:'python-telegram-bot',discord:'discord.py',usb:'pyusb',MySQLdb:'mysqlclient',psycopg2:'psycopg2-binary',zmq:'pyzmq',flask_cors:'flask-cors',jose:'python-jose',socks:'pysocks',Xlib:'python-xlib',attr:'attrs',gi:'pygobject',wx:'wxpython',lxml:'lxml',google:'protobuf'};
/* pacotes que costumam falhar no pip do Alpine (musl) e têm versão pronta no apk */
const APKPY={numpy:'py3-numpy',scipy:'py3-scipy',pandas:'py3-pandas',pillow:'py3-pillow',matplotlib:'py3-matplotlib',lxml:'py3-lxml',cryptography:'py3-cryptography',pyyaml:'py3-yaml',psutil:'py3-psutil','scikit-learn':'py3-scikit-learn',opencv:'py3-opencv','opencv-python':'py3-opencv','opencv-python-headless':'py3-opencv'};

const parseReq=txt=>{const out=[];for(let l of String(txt||'').split('\n')){l=l.replace(/\s+#.*$/,'').trim();if(!l||l[0]=='#'||l[0]=='-')continue;const m=/^([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(l);if(m)out.push(m[1].toLowerCase().replace(/_/g,'-'))}return out};

/* ---------- tabela de linguagens ---------- */
const RT={},EXT={};
const def=(id,o)=>{o.id=id;RT[id]=o;for(const e of o.ext)EXT[e]=id};
const has=(c,n)=>n in c.files;
const anyFile=(c,re)=>Object.keys(c.files).find(k=>re.test(k));
const PYPRE=c=>`V="$HOME/.cm/venv-${c.slug}"; PY=python3
if [ ! -x "$V/bin/python" ]; then mkdir -p "$HOME/.cm"; python3 -m venv --system-site-packages "$V" >/dev/null 2>&1 || virtualenv --system-site-packages "$V" >/dev/null 2>&1; "$V/bin/python" -m pip --version >/dev/null 2>&1 || rm -rf "$V"; fi
[ -x "$V/bin/python" ] && PY="$V/bin/python"
export PIP_BREAK_SYSTEM_PACKAGES=1 PIP_DISABLE_PIP_VERSION_CHECK=1 PYTHONUNBUFFERED=1 PYTHONPATH="$PWD"`;
const pipRetry=(name,apkNames)=>`"$PY" -m pip install -q ${Q(name)}`;
const javaInfo=c=>{const src=c.files[c.path]||'',m=/^\s*package\s+([\w.]+)\s*;/m.exec(src),d=dirOf(c.path),n=stem(c.path);let root=d;if(m){const pp=m[1].replace(/\./g,'/');if(d===pp)root='';else if(d.endsWith('/'+pp))root=d.slice(0,-(pp.length+1))}return{root:root||'.',fq:m?m[1]+'.'+n:n}};
const sibs=(c,re)=>{const d=dirOf(c.path),out=[c.path];for(const k of Object.keys(c.files)){if(k===c.path||dirOf(k)!==d||!re.test(k))continue;if(typeof c.files[k]==='string'&&!/\bmain\s*\(/.test(c.files[k]))out.push(k)}return out.map(Q).join(' ')};

def('python',{n:'Python',ext:['py','pyw'],bin:['python3'],apk:['python3 py3-pip py3-virtualenv'],tx:'python',to:120,
 pre:PYPRE,run:c=>`"$PY" ${Q(c.path)}`,
 steps:c=>{const o=[];if(has(c,'requirements.txt')){const names=parseReq(c.files['requirements.txt']),ap=names.map(n=>APKPY[n]).filter(Boolean);
   o.push({key:'req',label:'pip install -r requirements.txt',hash:hash(c.files['requirements.txt']),sent:'"$V/bin/python"',
    cmd:`"$PY" -m pip install -q -r requirements.txt || { command -v apk >/dev/null 2>&1 && apk add --no-cache build-base python3-dev libffi-dev openssl-dev ${ap.join(' ')} >/dev/null 2>&1; "$PY" -m pip install -q -r requirements.txt; }`})}
  else if(has(c,'pyproject.toml')||has(c,'setup.py'))o.push({key:'proj',label:'pip install -e .',hash:hash(c.files['pyproject.toml']||c.files['setup.py']),sent:'"$V/bin/python"',cmd:`"$PY" -m pip install -q -e .`});
  return o},
 miss:(out,c)=>{const m=/(?:ModuleNotFoundError|ImportError): No module named '([\w.]+)'/.exec(out);if(!m)return null;const top=m[1].split('.')[0];
  if(has(c,top+'.py')||Object.keys(c.files).some(k=>k.startsWith(top+'/')||k.includes('/'+top+'/')||k.endsWith('/'+top+'.py')))return null;
  const pk=PYMAP[top]||top;return okName(pk)?{name:pk,kind:'pip',cmd:`"$PY" -m pip install -q ${Q(pk)}`+(APKPY[pk.toLowerCase()]?` || { command -v apk >/dev/null 2>&1 && apk add --no-cache ${APKPY[pk.toLowerCase()]} >/dev/null 2>&1; }`:'')}:null}});

const nodeMiss=(out,c)=>{const m=/Cannot find (?:module|package) '([^']+)'/.exec(out);if(!m)return null;let n=m[1];if(/^[./]|^node:/.test(n))return null;const sp=n.split('/');n=n[0]=='@'?sp.slice(0,2).join('/'):sp[0];if(!okName(n))return null;return{name:n,kind:'npm',cmd:`npm install --no-audit --no-fund --loglevel=error ${Q(n)}`}};
const nodeSteps=c=>has(c,'package.json')?[{key:'npm',label:'npm install',hash:hash(c.files['package.json']+(c.files['package-lock.json']||'')),sent:'node_modules',cmd:'npm install --no-audit --no-fund --loglevel=error'}]:[];
def('node',{n:'JavaScript (Node.js)',ext:['js','mjs','cjs'],bin:['node'],apk:['nodejs npm'],tx:'nodejs',to:120,run:c=>`node ${Q(c.path)}`,steps:nodeSteps,miss:nodeMiss});
def('typescript',{n:'TypeScript',ext:['ts','mts','cts'],bin:['node','npx'],apk:['nodejs npm'],tx:'nodejs',to:180,run:c=>`npx -y tsx ${Q(c.path)}`,steps:nodeSteps,miss:nodeMiss});

def('java',{n:'Java',ext:['java'],bin:['javac','java'],apk:['openjdk21-jdk','openjdk17-jdk'],tx:'openjdk-21',to:240,
 extra:c=>has(c,'pom.xml')?[{bin:['mvn'],apk:['maven'],tx:'maven',n:'Maven'}]:[],
 run:c=>{const j=javaInfo(c);
  if(has(c,'pom.xml'))return `mvn -q -B -DskipTests compile && mvn -q -B dependency:build-classpath -Dmdep.outputFile="$T/cp.txt" && java -cp "target/classes:$(cat "$T/cp.txt")" ${Q(j.fq)}`;
  if(has(c,'build.gradle')||has(c,'build.gradle.kts'))return `if [ -x ./gradlew ]; then ./gradlew -q run --console=plain; elif command -v gradle >/dev/null 2>&1; then gradle -q run --console=plain; else echo 'Gradle ausente: rode  cm install gradle  (ou use ./gradlew no projeto)' >&2; exit 127; fi`;
  return `CP="$T/j"; [ -d lib ] && CP="$CP:lib/*"; rm -rf "$T/j"; mkdir -p "$T/j" && javac -nowarn -d "$T/j" -cp "$CP" -sourcepath ${Q(j.root)} ${Q(c.path)} && java -cp "$CP" ${Q(j.fq)}`}});

def('kotlin',{n:'Kotlin',ext:['kt','kts'],bin:['kotlinc','java'],apk:['openjdk21-jdk curl unzip'],tx:'kotlin',to:300,
 post:`command -v kotlinc >/dev/null 2>&1 || { KV=2.0.21; D="$HOME/.cm/kotlin"; mkdir -p "$D" && cd "$D" && curl -fsSL -o k.zip "https://github.com/JetBrains/kotlin/releases/download/v$KV/kotlin-compiler-$KV.zip" && unzip -q -o k.zip && rm -f k.zip && ln -sf "$D/kotlinc/bin/kotlinc" /usr/local/bin/kotlinc; }`,
 run:c=>/\.kts$/.test(c.path)?`kotlinc -script ${Q(c.path)}`:`kotlinc ${sibs(c,/\.kt$/)} -include-runtime -d "$T/k.jar" 2>&1 && java -jar "$T/k.jar"`});

def('go',{n:'Go',ext:['go'],bin:['go'],apk:['go'],tx:'golang',to:240,
 run:c=>has(c,'go.mod')?`go run ./${dirOf(c.path)||'.'}`.replace('./.','.'):`go run ${Q(c.path)}`,
 steps:c=>has(c,'go.mod')?[{key:'gomod',label:'go mod download',hash:hash(c.files['go.mod']+(c.files['go.sum']||'')),cmd:'go mod download'}]:[],
 miss:(out,c)=>/no required module provides package|go\.mod file not found|missing go\.sum entry|cannot find package|updates to go\.mod needed/.test(out)?{name:'go mod tidy',kind:'go',cmd:`[ -f go.mod ] || go mod init app; go mod tidy`}:null});

def('rust',{n:'Rust',ext:['rs'],bin:['rustc','cargo'],apk:['rust cargo'],tx:'rust',to:600,
 run:c=>{if(has(c,'Cargo.toml')){let m;if(m=/^src\/bin\/([^/]+)\.rs$/.exec(c.path))return `cargo run -q --bin ${Q(m[1])}`;if(m=/^examples\/([^/]+)\.rs$/.exec(c.path))return `cargo run -q --example ${Q(m[1])}`;return 'cargo run -q'}
  return `rustc -O ${Q(c.path)} -o "$T/r.out" && "$T/r.out"`}});

def('c',{n:'C',ext:['c'],bin:['gcc'],apk:['gcc musl-dev','build-base'],tx:'clang',to:180,run:c=>`gcc -O1 -Wall -o "$T/c.out" ${sibs(c,/\.c$/)} -lm && "$T/c.out"`});
def('cpp',{n:'C++',ext:['cpp','cc','cxx','c++'],bin:['g++'],apk:['g++ musl-dev','build-base'],tx:'clang',to:240,run:c=>`g++ -std=c++17 -O1 -Wall -o "$T/cc.out" ${sibs(c,/\.(cpp|cc|cxx|c\+\+)$/)} && "$T/cc.out"`});

def('csharp',{n:'C# (.NET)',ext:['cs'],bin:['dotnet'],apk:['dotnet8-sdk','dotnet9-sdk','dotnet10-sdk'],to:420,
 run:c=>{const pj0=anyFile(c,/\.csproj$/);const env='export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1; ';
  if(pj0)return env+`dotnet run --project ${Q(pj0)} -v q`;
  const d=dirOf(c.path)||'.';
  return env+`rm -rf "$T/cs"; mkdir -p "$T/cs" && cp ${Q(d)}/*.cs "$T/cs"/ && cd "$T/cs" && TFM="net$(dotnet --version | cut -d. -f1).0" && printf '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>%s</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>disable</Nullable></PropertyGroup></Project>' "$TFM" > cm.csproj && dotnet run -v q`}});

def('ruby',{n:'Ruby',ext:['rb'],bin:['ruby'],apk:['ruby ruby-bundler ruby-dev build-base','ruby ruby-bundler'],tx:'ruby',to:120,
 pre:c=>`export BUNDLE_PATH="$HOME/.cm/bundle-${c.slug}" GEM_HOME="$HOME/.cm/gems-${c.slug}" PATH="$HOME/.cm/gems-${c.slug}/bin:$PATH"`,
 run:c=>has(c,'Gemfile')?`bundle exec ruby ${Q(c.path)}`:`ruby ${Q(c.path)}`,
 steps:c=>has(c,'Gemfile')?[{key:'gem',label:'bundle install',hash:hash(c.files['Gemfile']+(c.files['Gemfile.lock']||'')),cmd:'bundle install --quiet'}]:[],
 miss:(out,c)=>{if(has(c,'Gemfile'))return null;const m=/cannot load such file -- ([\w-]+)/.exec(out);return m&&okName(m[1])?{name:m[1],kind:'gem',cmd:`gem install --no-document ${Q(m[1])}`}:null}});

def('php',{n:'PHP',ext:['php'],bin:['php'],apk:['php83 php83-phar php83-openssl php83-mbstring php83-curl php83-json php83-ctype','php82 php82-phar php82-openssl php82-mbstring php82-curl php82-json php82-ctype','php php-phar php-openssl php-mbstring php-curl'],tx:'php',to:120,
 post:`command -v php >/dev/null 2>&1 || { P=$(command -v php83 || command -v php82 || command -v php81); [ -n "$P" ] && ln -sf "$P" /usr/local/bin/php; }`,
 extra:c=>has(c,'composer.json')?[{bin:['composer'],apk:['composer'],tx:'composer',n:'Composer'}]:[],
 run:c=>`php ${Q(c.path)}`,
 steps:c=>has(c,'composer.json')?[{key:'composer',label:'composer install',hash:hash(c.files['composer.json']+(c.files['composer.lock']||'')),sent:'vendor',cmd:'COMPOSER_ALLOW_SUPERUSER=1 composer install --no-interaction --no-progress -q'}]:[]});

def('lua',{n:'Lua',ext:['lua'],bin:['lua5.4|lua5.3|lua5.1|luajit|lua'],apk:['lua5.4','lua5.3'],tx:'lua54',to:60,run:c=>`L=$(command -v lua5.4 || command -v lua5.3 || command -v lua5.1 || command -v luajit || command -v lua); "$L" ${Q(c.path)}`});
def('perl',{n:'Perl',ext:['pl','pm'],bin:['perl'],apk:['perl'],tx:'perl',to:60,run:c=>`perl ${Q(c.path)}`});
def('r',{n:'R',ext:['r'],bin:['Rscript'],apk:['R'],tx:'r-base',to:180,run:c=>`Rscript ${Q(c.path)}`,
 miss:(out)=>{const m=/there is no package called [‘'"]([^’'"]+)[’'"]/.exec(out);return m&&okName(m[1])?{name:m[1],kind:'cran',cmd:`Rscript -e "install.packages(${JSON.stringify(m[1])},repos='https://cloud.r-project.org')"`}:null}});
def('bash',{n:'Shell (bash)',ext:['sh','bash'],bin:['bash'],apk:['bash'],tx:'bash',to:120,run:c=>`bash ${Q(c.path)}`});
def('sqlite',{n:'SQL (SQLite)',ext:['sql'],bin:['sqlite3'],apk:['sqlite'],tx:'sqlite',to:60,run:c=>`sqlite3 -header -column :memory: < ${Q(c.path)}`});
def('elixir',{n:'Elixir',ext:['ex','exs'],bin:['elixir'],apk:['elixir'],tx:'elixir',to:180,run:c=>has(c,'mix.exs')?`mix run ${Q(c.path)}`:`elixir ${Q(c.path)}`,
 steps:c=>has(c,'mix.exs')?[{key:'mix',label:'mix deps.get',hash:hash(c.files['mix.exs']+(c.files['mix.lock']||'')),sent:'deps',cmd:'mix local.hex --force --if-missing >/dev/null 2>&1; mix local.rebar --force --if-missing >/dev/null 2>&1; mix deps.get'}]:[]});
def('haskell',{n:'Haskell',ext:['hs'],bin:['runghc|ghc'],apk:['ghc'],tx:'ghc',to:240,run:c=>`if command -v runghc >/dev/null 2>&1; then runghc ${Q(c.path)}; else ghc -o "$T/h.out" ${Q(c.path)} && "$T/h.out"; fi`});
def('nim',{n:'Nim',ext:['nim'],bin:['nim'],apk:['nim'],tx:'nim',to:240,run:c=>`nim c -r --hints:off --verbosity:0 -o:"$T/n.out" ${Q(c.path)}`});
def('zig',{n:'Zig',ext:['zig'],bin:['zig'],apk:['zig'],tx:'zig',to:240,run:c=>`zig run ${Q(c.path)}`});
def('ocaml',{n:'OCaml',ext:['ml'],bin:['ocaml'],apk:['ocaml'],tx:'ocaml',to:120,run:c=>`ocaml ${Q(c.path)}`});
def('fortran',{n:'Fortran',ext:['f90','f95','f03','f08','for','f'],bin:['gfortran'],apk:['gfortran'],to:180,run:c=>`gfortran -o "$T/f.out" ${Q(c.path)} && "$T/f.out"`});
def('cobol',{n:'COBOL',ext:['cob','cbl','cobol'],bin:['cobc'],apk:['gnucobol'],to:180,run:c=>`{ cobc -x -o "$T/cb.out" ${Q(c.path)} >/dev/null 2>&1 || cobc -x -free -o "$T/cb.out" ${Q(c.path)}; } && "$T/cb.out"`});
def('d',{n:'D',ext:['d'],bin:['ldc2|dmd'],apk:['ldc'],tx:'ldc',to:240,run:c=>`if command -v ldc2 >/dev/null 2>&1; then ldc2 -run ${Q(c.path)}; else dmd -run ${Q(c.path)}; fi`});
def('tcl',{n:'Tcl',ext:['tcl'],bin:['tclsh'],apk:['tcl'],tx:'tcl',to:60,run:c=>`tclsh ${Q(c.path)}`});

const ALIAS={py:'python',js:'node',nodejs:'node',ts:'typescript',golang:'go',rs:'rust','c++':'cpp',cs:'csharp',dotnet:'csharp',rb:'ruby',sh:'bash',sql:'sqlite',sqlite3:'sqlite',ex:'elixir',hs:'haskell',ml:'ocaml',f90:'fortran',cob:'cobol',kt:'kotlin',pl:'perl'};
const rtById=n=>{n=String(n||'').toLowerCase();return RT[n]||RT[ALIAS[n]]||null};
const rtFor=p=>{const e=(baseOf(p).split('.').pop()||'').toLowerCase();return RT[EXT[e]]||null};

/* ---------- montagem do script (função pura, testável) ---------- */
const ctxOf=(path,files)=>({path,files,slug:slugOf()});
const wrap=(c,rt,input,body)=>`T="\${TMPDIR:-/tmp}/cm"; mkdir -p "$T"\n${input?`printf '%s' ${Q(input)} > "$T/in.txt"\n`:''}${rt.pre?rt.pre(c)+'\n':''}{ ${body}\n} ${input?'< "$T/in.txt"':'< /dev/null'} 2>&1`;
const buildRun=(rt,path,files,input)=>{const c=ctxOf(path,files);return wrap(c,rt,input,rt.run(c))};
const stepScript=(c,rt,st)=>`T="\${TMPDIR:-/tmp}/cm"; mkdir -p "$T"; ${rt.pre?rt.pre(c)+'\n':''}SD="$HOME/.cm/stamps"; mkdir -p "$SD"; F="$SD/${c.slug}-${st.key}"\nif [ "$(cat "$F" 2>/dev/null)" = ${Q(st.hash)} ]${st.sent?` && [ -e ${st.sent} ]`:''}; then exit 0; fi\n{ ${st.cmd}\n} 2>&1; rc=$?\n[ $rc -eq 0 ] && echo ${Q(st.hash)} > "$F"; exit $rc`;
const miniScript=(c,rt,cmd)=>`T="\${TMPDIR:-/tmp}/cm"; mkdir -p "$T"; ${rt.pre?rt.pre(c)+'\n':''}{ ${cmd}\n} 2>&1`;
const reqsOf=(rt,c)=>[{bin:rt.bin,apk:rt.apk,tx:rt.tx,post:rt.post,n:rt.n},...(rt.extra?rt.extra(c):[])];
const probeScript=reqs=>{const L=['if command -v apk >/dev/null 2>&1; then echo "PM=apk"; elif command -v pkg >/dev/null 2>&1; then echo "PM=pkg"; else echo "PM=none"; fi'];
 for(const r of reqs)for(const b of r.bin)L.push(`ok=0; for x in ${b.split('|').join(' ')}; do command -v "$x" >/dev/null 2>&1 && ok=1; done; [ $ok -eq 1 ] || echo ${Q('MISSING:'+b)}`);return L.join('\n')};
const installScript=(r,pm)=>{if(pm==='apk')return r.apk.map((g,i)=>`${i?'|| ':''}apk add --update-cache ${g}`).join(' ')+(r.post?`\n${r.post}`:'');
 if(pm==='pkg'&&r.tx)return `pkg install -y ${r.tx}`+(r.post&&r.id!=='kotlin'?`\n${r.post}`:'');return ''};

/* ---------- execução ---------- */
const plain=s=>String(s||'').replace(/\r/g,'');
const tail=(s,n)=>{s=plain(s).trim();return s.length>n?'…'+s.slice(-n):s};
async function sh(script,to){const p=pj(),old=p.termCwd;p.termCwd='';try{return await shellRun(script,to)}catch(e){return{out:'Erro no terminal: '+(e&&e.message||e),code:1}}finally{p.termCwd=old}}
const askOk=async(title,text)=>{if(typeof S==='undefined'||S.mode==='auto')return true;return(await dlg({title,text,btns:['✅ Permitir','Cancelar']}))===0};

async function ensureTools(rt,c,log){
 const reqs=reqsOf(rt,c);
 for(let pass=0;pass<2;pass++){
  const r=await sh(probeScript(reqs),60),out=plain(r.out),pm=(/PM=(\w+)/.exec(out)||[])[1]||'none',miss=[...out.matchAll(/MISSING:(\S+)/g)].map(m=>m[1]);
  if(!miss.length)return{ok:true};
  if(pass===1)return{ok:false,msg:'Não consegui instalar: '+miss.join(', ')};
  const todo=reqs.filter(q=>q.bin.some(b=>miss.includes(b)));
  if(pm==='none')return{ok:false,msg:'Este terminal não tem gerenciador de pacotes (apk/pkg). Configure o Linux do app (cm linux) ou instale '+miss.join(', ')+' manualmente.'};
  for(const q of todo){
   const sc=installScript(Object.assign({id:rt.id},q),pm);if(!sc)return{ok:false,msg:'Não há pacote automático de '+q.n+' neste ambiente ('+pm+'). Use o Linux do app (cm linux) ou um executor remoto em Ajustes.'};
   if(!await askOk('Instalar '+q.n+'?','Para executar este arquivo falta: '+q.bin.join(', ')+'.\nVou instalar no Linux do CodeMobile ('+pm+'). Pode baixar dezenas de MB e levar alguns minutos.'))return{ok:false,msg:'Instalação de '+q.n+' cancelada.'};
   log('📦 instalando '+q.n+'…');const ir=await sh(sc,1500);if(ir.code&&!/post/.test(sc))log(tail(ir.out,600));
  }
  try{if(typeof natCaps=='function'&&NAT&&NAT.ready)await natCaps()}catch(e){}
 }
 return{ok:false,msg:'Falha ao instalar ferramentas.'};
}
async function runSteps(rt,c,log,memo){
 for(const st of (rt.steps?rt.steps(c):[])){
  if(!memo.ok&&!(memo.ok=await askOk('Instalar dependências?',st.label+'\nAs dependências do projeto serão baixadas para o Linux do CodeMobile.')))return{ok:false,msg:'Instalação de dependências cancelada.'};
  const r=await sh(stepScript(c,rt,st),1500);
  if(r.code){log('❌ '+st.label+' (código '+r.code+')\n'+tail(r.out,1200));return{ok:false,msg:st.label+' falhou.'}}
  if(r.out&&plain(r.out).trim())log('📦 '+st.label+' ✓');
 }
 return{ok:true};
}
/* roda um arquivo de verdade; devolve {ok,out,code} ou null se não houver suporte (cai nos caminhos antigos) */
async function runReal(path,input,opt={}){
 if(typeof real!=='function'||!real())return null;
 if(typeof S!=='undefined'&&S.mode==='plan')return null;
 const rt=rtFor(path);if(!rt)return null;
 const p=pj(),files=p.files;if(typeof files[path]!=='string')return null;
 const c=ctxOf(path,files),logs=[],log=m=>logs.push(m),memo={ok:false};
 const fin=(ok,body,code)=>({ok,code,out:(logs.length?logs.join('\n')+'\n':'')+body});
 const tools=await ensureTools(rt,c,log);if(!tools.ok)return fin(false,tools.msg,1);
 const st=await runSteps(rt,c,log,memo);if(!st.ok)return fin(false,st.msg,1);
 const to=Math.min(+opt.timeout||rt.to||120,1800),seen=new Set();let r;
 for(let n=0;n<=6;n++){
  r=await sh(buildRun(rt,path,files,input),to);
  if(!r.code||!rt.miss)break;
  const m=rt.miss(plain(r.out),c);if(!m||seen.has(m.name))break;seen.add(m.name);
  if(!memo.ok&&!(memo.ok=await askOk('Instalar pacote?',m.name+' ('+m.kind+') é necessário para rodar '+path+'.')))break;
  log('📦 instalando '+m.name+'…');
  const ir=await sh(miniScript(c,rt,m.cmd),1200);
  if(ir.code){log('❌ não consegui instalar '+m.name+':\n'+tail(ir.out,600));break}
 }
 const body=r.to?'⏱ Tempo esgotado ('+to+'s). Programa interativo, loop infinito ou compilação lenta; passe input se ele lê a entrada.\n'+tail(r.out,2500):(plain(r.out).trim()||'(sem saída)');
 return fin(!r.code&&!r.to,body,r.code);
}
/* instala dependências do projeto inteiro (todas as linguagens presentes) */
async function installDeps(a){
 a=a||{};if(typeof real!=='function'||!real())return'Instalar dependências de verdade precisa do Linux do app (cm linux) ou do servidor Termux. Sem isso, rodar um .py instala pacotes Python puros no navegador (micropip) automaticamente.';
 if(S.mode==='plan')return'Modo plano: não instalo nada. Apresente o plano e peça aprovação.';
 const p=pj(),files=p.files,out=[];
 if(a.pkg){const n=String(a.pkg).trim(),mg=String(a.manager||'').toLowerCase();if(!okName(n))return'Erro: nome de pacote inválido.';
  const hasPy=Object.keys(files).some(k=>/\.py$/.test(k)),hasNode=has({files},'package.json');
  const kind=mg||(hasNode?'npm':hasPy?'pip':'npm'),c=ctxOf('x.py',files);
  if(!await askOk('Instalar pacote?',n+' ('+kind+')'))return'Negado: o usuário não autorizou.';
  let sc,rt0=RT.python;
  if(kind==='pip'){const t=await ensureTools(RT.python,c,m=>out.push(m));if(!t.ok)return t.msg;sc=miniScript(c,RT.python,`"$PY" -m pip install -q ${Q(n)}`)}
  else if(kind==='npm'){const t=await ensureTools(RT.node,c,m=>out.push(m));if(!t.ok)return t.msg;sc=`npm install --no-audit --no-fund --loglevel=error ${Q(n)} 2>&1`}
  else if(kind==='apk'||kind==='pkg'){sc=`(command -v apk >/dev/null 2>&1 && apk add --update-cache ${Q(n)} || pkg install -y ${Q(n)}) 2>&1`}
  else if(kind==='gem'){const t=await ensureTools(RT.ruby,c,m=>out.push(m));if(!t.ok)return t.msg;sc=miniScript(c,RT.ruby,`gem install --no-document ${Q(n)}`)}
  else if(kind==='composer'){sc=`COMPOSER_ALLOW_SUPERUSER=1 composer require ${Q(n)} --no-interaction -q 2>&1`}
  else if(kind==='go'){sc=`[ -f go.mod ] || go mod init app; go get ${Q(n)} 2>&1`}
  else return'Erro: manager deve ser pip, npm, apk, gem, composer ou go.';
  const r=await sh(sc,1200);return(r.code?'❌ Falhou (código '+r.code+')':'✅ '+n+' instalado')+'\n'+tail(r.out,1500)+(out.length?'\n'+out.join('\n'):'')}
 const memo={ok:false},seen=new Set();
 for(const rt of Object.values(RT)){
  if(!rt.steps)continue;const first=Object.keys(files).find(k=>rtFor(k)===rt),c=ctxOf(first||('x.'+rt.ext[0]),files);
  const sts=rt.steps(c);if(!sts.length||seen.has(rt.id))continue;seen.add(rt.id);
  const t=await ensureTools(rt,c,m=>out.push(m));if(!t.ok){out.push('❌ '+rt.n+': '+t.msg);continue}
  const lg=[],s=await runSteps(rt,c,m=>lg.push(m),memo);out.push(...(lg.length?lg:['✓ '+rt.n+': '+sts.map(x=>x.label).join(', ')]));if(!s.ok)out.push('❌ '+(s.msg||''));
 }
 return out.length?out.join('\n'):'Nenhum arquivo de dependências reconhecido (requirements.txt, pyproject.toml, package.json, go.mod, Gemfile, composer.json, mix.exs, pom.xml). Cargo.toml e pom.xml baixam as bibliotecas na hora de rodar.';
}

/* ---------- Python no navegador com micropip (sem Linux) ---------- */
const PYV='https://cdn.jsdelivr.net/pyodide/v0.29.4/full/';
const PYW2=`importScripts('${PYV}pyodide.js');let py,prev=[],mp=null;const MAP=${JSON.stringify(PYMAP)};
const names=t=>String(t||'').split('\\n').map(l=>l.replace(/\\s+#.*$/,'').trim()).filter(l=>l&&l[0]!='#'&&l[0]!='-').map(l=>(/^[A-Za-z0-9][A-Za-z0-9._-]*/.exec(l)||[''])[0]).filter(Boolean);
onmessage=async e=>{const d=e.data;let out='',pre='';
 try{if(!py)py=await loadPyodide({indexURL:'${PYV}'});
  py.setStdout({batched:s=>{out+=s+'\\n'}});py.setStderr({batched:s=>{out+=s+'\\n'}});
  const q=d.input?d.input.split('\\n'):[];py.setStdin({stdin:()=>q.length?q.shift():undefined});
  for(const k of prev){try{py.FS.unlink('/home/pyodide/'+k)}catch(e0){}}prev=[];
  for(const[k,v]of Object.entries(d.files)){if(typeof v!=='string')continue;const i=k.lastIndexOf('/');if(i>0)py.FS.mkdirTree('/home/pyodide/'+k.slice(0,i));py.FS.writeFile('/home/pyodide/'+k,v);prev.push(k)}
  try{await py.loadPackagesFromImports(Object.values(d.files).filter(x=>typeof x==='string'&&x.length<60000).join('\\n'))}catch(e2){}
  const pip=async n=>{if(!mp){await py.loadPackage('micropip');mp=py.pyimport('micropip')}await mp.install(n)};
  const done=new Set();
  if(d.files['requirements.txt'])for(const n of names(d.files['requirements.txt'])){if(done.has(n))continue;done.add(n);try{await pip(n);pre+='📦 '+n+'\\n'}catch(e3){pre+='⚠ '+n+' não instalou no navegador (só pacotes Python puros ou do Pyodide): '+String(e3.message||e3).split('\\n')[0]+'\\n'}}
  py.globals.set('__main_path',d.main);
  const local=n=>Object.keys(d.files).some(k=>k===n+'.py'||k.startsWith(n+'/')||k.endsWith('/'+n+'.py'));
  for(let t=0;;t++){out='';
   try{await py.runPythonAsync("import os,sys,runpy\\nos.chdir('/home/pyodide')\\nsys.path.insert(0,'/home/pyodide')\\nrunpy.run_path(__main_path,run_name='__main__')");break}
   catch(err){const m=/No module named '([\\w.]+)'/.exec(String(err&&err.message||err)),top=m&&m[1].split('.')[0];
    if(!top||t>=5||done.has(top)||local(top))throw err;done.add(top);const n=MAP[top]||top;
    try{await pip(n);pre+='📦 '+n+'\\n'}catch(e4){throw new Error(String(err.message||err)+'\\n⚠ tentei instalar '+n+' no navegador e não deu: '+String(e4.message||e4).split('\\n')[0]+'\\nPara pacotes com código nativo use o Linux do app (cm linux).')}}}
  postMessage({id:d.id,ok:true,out:pre+out})}
 catch(err){postMessage({id:d.id,ok:false,out:pre+out+String(err&&err.message||err)})}};`;
let PWk=null,PNk=0;const PPk={};
function pyRun2(files,main,input,ms=20000){return new Promise(res=>{const first=!PWk,slow=first||!!files['requirements.txt'];
 if(!PWk){try{PWk=new Worker(URL.createObjectURL(new Blob([PYW2],{type:'text/javascript'})))}catch(e){return res({ok:false,out:'Python indisponível neste aparelho: '+e.message})}
  PWk.onmessage=e=>{const f=PPk[e.data.id];if(f){delete PPk[e.data.id];f(e.data)}};
  PWk.onerror=e=>{Object.keys(PPk).forEach(k=>{PPk[k]({ok:false,out:'Falha ao iniciar o Python (precisa de internet na 1ª vez para baixar o interpretador): '+(e.message||'')});delete PPk[k]});try{PWk.terminate()}catch(_){}PWk=null}}
 const id=++PNk;let tm;PPk[id]=r=>{clearTimeout(tm);res(r)};
 const lim=slow?120000:ms;tm=setTimeout(()=>{delete PPk[id];try{PWk.terminate()}catch(_){}PWk=null;res({ok:false,tmo:1,out:'⏱ Tempo esgotado ('+lim/1000+'s): loop infinito, programa interativo ou download lento. Se usa input(), passe o parâmetro input.'})},lim);
 PWk.postMessage({id,files,main,input:input||''})})}

/* ---------- ligação com o app ---------- */
const BROWSERJS=/\b(document|window|localStorage|alert|requestAnimationFrame|navigator)\b/;
const fmt=r=>(r.ok?'✅ Executou sem erros':'❌ Falhou'+(r.code?' (código '+r.code+')':''))+'\n'+(r.out||'(sem saída)').slice(-5000);
const api={RT,EXT,ALIAS,PYMAP,parseReq,rtFor,rtById,buildRun,stepScript,probeScript,installScript,reqsOf,javaInfo,ctxOf,runReal,installDeps,pyRun2,PYW2};
G.CodeMobileExec=api;
if(typeof exec==='undefined'||typeof T==='undefined')return;   /* ambiente de teste sem o app */

try{if(typeof pyRun==='function')pyRun=pyRun2}catch(e){}
{const _e=exec;exec=async function(n,a){a=a||{};
 if(n==='install_deps')return installDeps(a);
 if(n==='run_file'){const p=String(a.path||''),f=pj().files,rt=rtFor(p);
  if(rt&&p in f&&!((rt.id==='node'||rt.id==='typescript')&&BROWSERJS.test(f[p]||''))){const r=await runReal(p,a.input||'',{timeout:a.timeout});if(r){VER=r.ok?'ok':'err';return fmt(r)}}}
 return _e(n,a)}}
try{T.push(['install_deps','Instala dependências no Linux real: sem argumentos lê requirements.txt, pyproject.toml, package.json, go.mod, Gemfile, composer.json, mix.exs e instala (e instala o compilador/runtime que faltar). Com pkg="nome" instala um pacote avulso; manager = pip, npm, apk, gem, composer ou go (padrão: pelo projeto).',{pkg:'string?',manager:'string?'}]);
 if(typeof GRP!=='undefined'&&GRP.run)GRP.run.push('install_deps');if(typeof ico!=='undefined')ico.install_deps='📦';
 const rf=T.find(t=>t[0]==='run_file');if(rf)rf[1]='Executa um arquivo do projeto de verdade e devolve saída/erros. Com o Linux do app (ou Termux) roda Python, Node, TypeScript, Java, Kotlin, Go, Rust, C, C++, C#, Ruby, PHP, Lua, Perl, R, Bash, SQL, Elixir, Haskell, Nim, Zig, OCaml, Fortran, COBOL, D e Tcl: instala sozinho o compilador e as dependências (requirements.txt, package.json, go.mod, Cargo.toml, pom.xml, Gemfile, composer.json). Sem Linux roda no navegador: Python (com pip puro via micropip), JS, TS, Lua, SQL, C/C++ (subconjunto), Ruby, PHP e sh. input = texto do stdin (uma linha por input()); timeout em segundos (opcional).';
 if(rf&&rf.js===undefined&&rf[2])rf[2].timeout='int?'}catch(e){}
try{const _sy=sys;sys=function(){const b=_sy();if((typeof CHATONLY!=='undefined'&&CHATONLY)||S.fast||(typeof LITE=='function'&&LITE()))return b;
 return b+'\nEXECUÇÃO: '+(real()?'run_file roda de verdade no Linux (Python, Node, TS, Java, Kotlin, Go, Rust, C/C++, C#, Ruby, PHP, Lua, Perl, R, Bash, SQL, Elixir, Haskell, Nim, Zig e mais) e instala compilador e dependências sozinho; se faltar pacote ele instala e roda de novo. Use install_deps para dependências/pacote avulso e shell para o resto (pip, npm, apk, make). Programas que leem stdin: passe input.':'run_file roda no navegador (Python com micropip, JS, TS, Lua, SQL, C/C++ subconjunto, Ruby, PHP). Java/Go/Rust/C#/Kotlin etc. exigem o Linux do app (cm linux).')}}catch(e){}
try{const _fi=ftIcon,M={kt:'🟣',kts:'🟣',ex:'💧',exs:'💧',hs:'λ',nim:'👑',zig:'⚡',ml:'🐫',f90:'🧮',cob:'📠',cbl:'📠',d:'🅳',tcl:'🪶'};ftIcon=function(n){const e=(n.split('.').pop()||'').toLowerCase();return M[e]||_fi(n)}}catch(e){}

/* ---------- comandos do terminal: cm run | cm deps | cm langs | cm install <linguagem> ---------- */
const R=(o,c=0)=>({out:o,code:c});
async function langsReport(){
 const all=Object.values(RT);if(typeof real!=='function'||!real())return'Linguagens que rodam de verdade com o Linux do app (cm linux): '+all.map(r=>r.n).join(', ')+'.\nSem Linux: Python (micropip), JS, TS, Lua, SQL, C/C++ (subconjunto), Ruby, PHP e sh no navegador.\n';
 const sc=all.map(r=>`ok=0; for x in ${r.bin[0].split('|').join(' ')}; do command -v "$x" >/dev/null 2>&1 && ok=1; done; echo "${r.id}:$ok"`).join('\n'),r=await sh(sc,60),st={};
 for(const m of plain(r.out).matchAll(/^(\w+):(\d)$/gm))st[m[1]]=m[2]==='1';
 return all.map(x=>(st[x.id]?'✅ ':'⬜ ')+x.n+' ('+x.ext.map(e=>'.'+e).join(' ')+')'+(st[x.id]?'':'  → cm install '+x.id)).join('\n')+'\n\n✅ instalado · ⬜ instala sozinho ao rodar um arquivo (ou: cm install <nome>)\n';
}
try{const X=VSH.x,_cm=X.cm;
 X.cm=async(f,a,inp)=>{const v=a[0],sub=a[1];
  if(v==='langs')return R(await langsReport());
  if(v==='deps')return R((await installDeps({}))+'\n');
  if(v==='run'){if(!sub)return R('Uso: cm run ARQUIVO [--input "texto"] [--timeout SEG]\n',2);const path=sub.replace(/^\.\//,''),ii=a.indexOf('--input'),ti=a.indexOf('--timeout');
   if(!(path in pj().files))return R('cm run: arquivo não encontrado: '+sub+'\n',2);const r=await runReal(path,ii>0?String(a[ii+1]||'').replace(/\\n/g,'\n'):'',{timeout:ti>0?+a[ti+1]:0});
   if(!r)return R('cm run: '+(rtFor(path)?'precisa do Linux do app (cm linux).':'linguagem sem suporte: .'+path.split('.').pop())+'\n',1);return R(r.out+'\n',r.code||0)}
  if(v==='install'&&rtById(sub)){const rt=rtById(sub),c=ctxOf('x.'+rt.ext[0],pj().files),lg=[];
   if(typeof real!=='function'||!real())return R('Configure primeiro o Linux: cm linux\n',1);
   const t=await ensureTools(rt,c,m=>lg.push(m));return R((lg.length?lg.join('\n')+'\n':'')+(t.ok?'✅ '+rt.n+' pronto.\n':'❌ '+t.msg+'\n'),t.ok?0:1)}
  const r=await _cm(f,a,inp);
  if(v==='help'&&r&&typeof r.out==='string')r.out+='\nExecução real:\n  cm run ARQUIVO [--input "texto"]  roda (instala compilador e dependências)\n  cm deps                            instala dependências do projeto\n  cm langs                           linguagens instaladas/disponíveis\n  cm install <linguagem>             ex.: kotlin, csharp, zig, elixir, r, haskell\n';
  return r};
 if(X.langs){const _l=X.langs;X.langs=async(f,a,i)=>real()?R(await langsReport()):_l(f,a,i)}
}catch(e){}
})();
