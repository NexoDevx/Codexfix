# CodeMobile — gerar o APK (sem servidor)

1. Termux: `pkg install git unzip`, depois `unzip codemobile.zip && cd codemobile`
2. Crie um repositório vazio no GitHub (ex.: codemobile) e um token em github.com/settings/tokens
   com os escopos **repo** e **workflow** (sem `workflow` o push do .github/workflows é recusado).
3. `git init -b main && git add . && git commit -m "CodeMobile"`
   `git remote add origin https://github.com/SEU_USUARIO/codemobile.git`
   `git push -u origin main`  (usuário = seu login, senha = o token)
4. No GitHub: aba **Actions → Build APK → Run workflow** (roda também a cada push). Leva alguns minutos.
5. Abra a execução concluída, baixe o artefato **CodeMobile-apk** (vem em .zip), extraia e instale o app-debug.apk
   (permita "instalar apps desconhecidos").
6. Para atualizar: altere os arquivos em www/, `git commit` e `git push`; baixe o novo APK.

## Terminal do agente (3 níveis, o app escolhe o melhor sozinho)

1. **Linux embutido no APK (sem servidor, sem Termux).** O build do GitHub Actions coloca dentro do app o `proot` e um Alpine Linux (aarch64). No app: ＋ → Terminal (ou aba ⌨️ Terminal) → **Instalar Linux completo**. Na primeira vez baixa git, python, node, ripgrep, fd, jq, tree, curl, wget, zip, make (1 a 3 min, precisa de internet). Depois o agente tem um Linux de verdade: `git`, `python3`, `pip`, `node`, `npm`, `rg`, `apk add <pacote>`...
2. **Termux (opcional):** se preferir, `sh start.sh` no Termux sobe o servidor e o app usa o Termux.
3. **Mini-terminal embutido (sempre disponível):** ls, cat, head, tail, wc, grep, rg, find, tree, sed, sort, uniq, echo, mkdir, touch, rm, mv, cp, cd, pwd, `python` (Pyodide), `node`; pipes, `&&`, `||`, `>`. Sem git/npm/pip.

O agente recebe no prompt qual nível está ativo e quais ferramentas existem. Você usa o mesmo terminal na aba ⌨️.

### Sobre o Linux embutido (leia)
- É **experimental**: o código nativo (`native/ShellPlugin.java`) e o download do proot/Alpine não puderam ser compilados/testados onde eu escrevi. Por segurança o workflow tem rede de proteção: se o passo opcional ou o build com o Linux falhar, ele refaz o APK **sem** o Linux e o app continua funcionando com o mini-terminal (aparece um aviso amarelo no Actions). Se isso acontecer, abra o log do passo "Linux embutido" ou "Build" e me mande o erro.
- Só arm64 (quase todos os celulares atuais). Roda via `proot` (não é root real; alguns programas que dependem do kernel podem falhar).
- O Termux em si não dá para colocar dentro de um APK moderno: os pacotes têm o caminho `/data/data/com.termux/...` gravado e, desde o Android 10, apps não executam binários da própria pasta de dados (regra W^X). Por isso o caminho usado aqui é proot + Alpine, que é o que apps como UserLAnd fazem.

No APK o login do GitHub e o web_fetch usam HTTP nativo (sem CORS).


## Novidades (ext.js)
- **Conversa x ação:** "oi", "opa", agradecimentos e perguntas gerais recebem só uma resposta em texto (sem ferramentas e sem criar arquivos, com um prompt bem menor = menos tokens). Só cria/edita quando o pedido é explícito ("crie", "faça", "corrija"...).
- **Importar ZIP:** ＋ → Adicionar arquivo → escolha um .zip. Os arquivos de texto vão para `importados/<nome>/` (só leitura para a IA) e a caixa de texto já vem com "Veja o ZIP que importei em … e " para você completar ("crie um app parecido", "explique", etc.).
- **MCP:** ＋ → MCP e plugins → Adicionar servidor MCP (nome, URL HTTP e token opcional). As ferramentas aparecem para o agente como `mcp__servidor__ferramenta`. Só MCP por HTTP (Streamable HTTP/JSON ou SSE); servidores stdio/npx não rodam aqui.
- **Plugins:** ＋ → MCP e plugins → Instalar plugin (URL de um JSON ou o JSON colado):
  `{"name":"x","description":"...","skills":[{"name":"rev","description":"...","body":"..."}],"commands":{"rev":"Revise tudo. $ARGS"},"mcp":[{"name":"srv","url":"https://.../mcp","token":"..."}],"instructions":"texto para o AGENTS.md"}`
  Skills entram no projeto atual (`skills/<nome>/SKILL.md`), comandos viram `/comando`, servidores MCP são conectados.

## Plugins do GitHub e pastas conectadas (ext2.js)
- **＋ → MCP e plugins → Instalar do GitHub:** cole o link de um repositório ou de uma subpasta (`https://github.com/dono/repo` ou `.../tree/main/pasta`). Escolha *Ativar* (instala skills de `skills/*/SKILL.md`, comandos de `commands/*.md`, servidores MCP por HTTP de `.mcp.json`/`plugin.json`, e o AGENTS.md/CLAUDE.md do repo) ou *Baixar como referência* (até 120 arquivos de texto em `importados/<repo>/`). Se o link for um catálogo (`.claude-plugin/marketplace.json`) você escolhe quais plugins ativar. Repositórios privados: conecte sua conta em Ajustes → GitHub (sem conta o limite da API é pequeno). Servidores MCP que rodam por `npx`/comando local (stdio) são ignorados.
- **＋ → Pastas conectadas:** *Conectar pasta* abre o seletor de pastas do Android (plugin nativo `FolderPlugin`, precisa do APK) ou o do navegador (PWA/desktop). Os arquivos de texto vão para `importados/<pasta>/`. A IA lê à vontade e só edita quando você pede (o app confirma, a menos que seu pedido cite a pasta e peça a mudança). As alterações só vão para a pasta real quando você toca em *Salvar alterações na pasta*; *Atualizar da pasta* relê do aparelho.
- **Limite do Android:** desde o Android 11 o seletor de pastas não acessa `Android/data` nem `Android/obb`. Pastas em Documentos/Download/armazenamento interno funcionam (no Minecraft Bedrock, ative o armazenamento externo para `games/com.mojang` ficar acessível).
- **Plugin nativo é opcional:** o workflow tenta o build completo e, se falhar, tenta só com Linux, só com a pasta nativa e por fim sem nativos (avisos amarelos no Actions).

## Roadmap — o que já foi feito e o que falta

**Feito e testado (`npm test`: 11 testes do servidor + ~60 do terminal):**
- 1.1 Nomes e caminhos: validação central (`validName` no app; o servidor e o plugin Java repetem a regra). `.`, `..`, vazio e reservados são rejeitados; nomes que viram o mesmo diretório ganham sufixo hash (sem colisão); escrita nunca sai do projeto nem segue symlink. *Bug real corrigido: um projeto chamado `..` apontava o workspace para a pasta `data/`.*
- 1.2 Servidor: token aleatório por instalação (30 dias, `POST /api/rotate` revoga), comparação em tempo constante, rotas e métodos validados, limites de corpo/frequência/comandos simultâneos, auditoria em `data/audit.log` sem segredos, bloqueio de `cm-config.js`/`cm-state.js` para páginas de outros sites, DNS resolvido contra IP privado no `/api/fetch`. O token fica fora do estado do app (`localStorage cm_tok`). No APK o app pede o token uma vez.
- 1.3 parcial: ambiente do shell sem variáveis herdadas (só PATH/HOME/etc.), no máx. 2 comandos simultâneos, timeout, saída limitada, kill da árvore de processos.
- 2.2 parcial: sincronização por manifesto: só apaga do disco o que o app gerenciava e removeu; arquivos externos nunca são apagados (servidor e Java).
- Fase 6 (mini-terminal): glob, `$VAR`, `$(...)`, `for`/`if`, `git` local real (init/add/commit/status/diff/log/branch/checkout/reset/restore/rm), diff, awk, jq, cut, tr, xargs, tee, printf, curl/wget, `npm run`, test/[ ].
- Bug da versão enviada: `extras.js` quebrava por causa de `sys`/`sys0` (aba Terminal e menu de conversas não carregavam). Corrigido.

**Segurança por ambiente (honesto):** mini-terminal = roda em JavaScript no WebView, só enxerga os arquivos do projeto (mais seguro, menos poderoso). Linux embutido = proot sem root real, isolado do resto do Android, mas com rede e acesso à pasta do projeto. Termux = shell real do seu usuário Android: o token impede outros sites/apps de usá-lo, mas um comando aprovado pode tudo que o Termux pode. As confirmações do app são conveniência; o limite real é o executor.

**Ainda não feito (ordem sugerida):** 1.4 Keystore para chaves · 2.1/2.3/2.4 workspace unificado, snapshots reais e validação de ZIP · Fase 3 motor (planejar/verificar/tools tipadas) · Fase 4 adaptadores por provedor · 5.x descoberta de testes/diagnóstico · 7 tarefas longas persistentes · 8 permissões granulares/diff por bloco · 9 subagentes · 10.3 hooks.


## Imagens, visual da logo e projeto limpo (img.js, brand.css)
- **Importar fotos:** ＋ → Adicionar arquivo aceita PNG, JPG, WebP, GIF… Você escolhe: *mostrar para a IA* (ela enxerga a imagem na próxima mensagem; o modelo precisa aceitar imagens), *salvar como asset* (vai para `assets/` e o jogo/site usa) ou os dois. As imagens são reduzidas (máx. 1024 px, WebP) e guardadas no IndexedDB; o projeto guarda só uma referência curta (`img:id`), então checkpoints e conversas não incham. SVG continua sendo arquivo de texto.
- **Assets no preview, ZIP e GitHub:** o preview troca o caminho literal (`assets/hero.webp`) pela imagem; o ZIP exportado e o `gh_push` levam a imagem de verdade (binária). Caminhos montados em código (`'assets/'+nome`) não são trocados no preview: peça para o agente usar o caminho completo. O terminal Linux/Termux não enxerga os assets (só texto).
- **Economia de tokens com imagens:** só a imagem mais recente é enviada e só nas primeiras 3 rodadas da tarefa.
- **Gerar imagens (`generate_image`):** só aparece para o agente se houver capacidade: chave da OpenAI (gpt-image-1, com queda para dall-e-3) ou do Gemini (gemini-2.5-flash-image), ou Pollinations (grátis, escolhido em Ajustes → Geração de imagens). Sem isso o agente é avisado de que não gera imagens e desenha em SVG/canvas ou usa os assets que você anexar. Respeita modo plano, "perguntar" e as regras de permissão.
- **Projeto limpo:** o app já nasce com o Projeto 1 vazio. Para limpar um projeto que você mexeu: ＋ → *Limpar este projeto* (ou Ajustes → Projeto). Apaga arquivos, conversas, anexos e tarefas daquele projeto.
- **Visual:** nova identidade em `www/brand.css` a partir da logo `</>` (brasa laranja sobre tinta): cabeçalho, mensagens, compositor, navegação, terminal e boas-vindas. Para voltar ao visual antigo, tire a linha do `brand.css` no `index.html`.


## Plugin/MCP por link, direto na conversa (ext2.js)
- **Cole o link do GitHub no chat** (aceita `https://github.com/dono/repo`, `.../repo.git`, `git@github.com:dono/repo.git`, `.../tree/main/pasta`). Sozinho ou com "instala/conecta/baixa esse plugin ...", o app baixa e ativa na hora **sem chamar o modelo** (não gasta tokens): skills (`SKILL.md`), comandos, servidores MCP por HTTP e `AGENTS.md`. Se o repositório não tiver nada ativável, baixa como referência em `importados/<repo>/` (texto, até 120 arquivos). Se o seu pedido tiver mais coisa depois do link ("instala X e analise Y"), o app instala e só então manda o resto para a IA.
- **A IA também pode instalar:** ferramenta `install_plugin` (pedido em linguagem natural). Se você não citou o repositório, o app pergunta antes de instalar; modo Plano bloqueia.
- **Servidores MCP stdio (npx/comando local), como o `morluto/rea`:** não rodam dentro do app. O instalador baixa o que for aproveitável (skill/instruções) e mostra o comando para criar uma **ponte HTTP no Termux** (`npx -y supergateway --stdio "..." --port 8000`) e o endereço para adicionar em ＋ → MCP e plugins. Confira se as ferramentas do servidor funcionam no Android (o REA, por exemplo, foca em análise de apps nativos e depende de ferramentas externas).
- Teste: `node test/plugin.test.mjs` (fetch simulado).

## Editor de APK

Aba 📁 Arquivos → **📱 Abrir APK** (ou ＋ → Adicionar arquivo com um .apk). Lista os arquivos (com busca), mostra pacote/versão/SDK/permissões e permite:
- **Ver**: imagens, textos, XML binário decodificado (o AndroidManifest fica legível), hex para o resto.
- **Editar**: texto direto; **XML binário como texto** (✏️ Editar como texto → compila de volta, com os atributos ordenados por ID como o Android exige); trocar/remover/adicionar arquivos; trocar imagem (ajusta ao tamanho e formato originais).
- **💾 Salvar e assinar**: regrava o APK e assina com v1 (JAR) + v2, com uma chave RSA-2048 gerada e guardada no aparelho (🔑 Chave: exportar backup, importar, gerar nova). Mantenha a mesma chave para poder atualizar seus APKs editados. Se o app original estiver instalado, desinstale antes (assinatura diferente). Também há "Salvar sem assinar".
- **🧩 Plugins**: scripts JS que usam a API `apk` (list, read, text, write, remove, search, strings, hex, imageSize, replaceImage, pickFile) + `log`, `prompt`, `confirm`. Vêm 4 prontos (trocar imagens por padrão, buscar no APK, renomear app/pacote, ligar debuggable); você cria, edita e importa `.js` (`// @name` e `// @desc` no topo). Plugins têm acesso total ao APK aberto: só use os de quem você confia.
- **Agente de IA**: com um APK aberto, o agente ganha as ferramentas `apk_status`, `apk_list`, `apk_search`, `apk_read`, `apk_write`, `apk_replace_image`, `apk_remove`, `apk_script` e `apk_build`. Ex.: "ache os sprites do personagem, gere uma vaca (generate_image) e troque". Combina com a geração de imagens dos Ajustes.

Limites: não decompila `classes.dex`, não edita `resources.arsc` (nomes de app que vêm de recurso), sem ZIP64, sem assinatura v3/v4; imagens 9-patch perdem os metadados ao trocar; apps com sprites em formato próprio (atlas/pacotes) não têm imagens soltas para trocar. Testes: `npm test` (inclui verificação da assinatura com `jarsigner` e `test/VerifyV2.java`, que precisam de JDK).


## Núcleo do agente (nucleo.js)
Camada nova, escrita para este projeto (inspirada em ideias gerais de agentes de código, sem copiar nenhum código). Carrega por último e estende `exec`, `llm` e `sys` sem alterar a lógica existente. Testes: `node --test test/nucleo.test.mjs`.

- **Compactação incremental:** quando o contexto passa de ~100 mil caracteres (32 mil no modo ⚡ Fast), as mensagens antigas viram um resumo e as recentes continuam inteiras. O histórico visível no app **não muda** (diferente do `/compact` antigo, que apaga tudo), resultados antigos de ferramentas são encurtados no histórico bruto e o resumo é reaproveitado nas próximas chamadas. Se o resumo falhar, segue como antes. Comando `/compactar` força. O resumo total antigo só dispara agora acima de 1,2 MB.
- **Regras de permissão por ferramenta e caminho:** `.codemobile/regras.txt`, linhas `permitir|negar|perguntar <ferramenta> [padrão]` (aceita `*` e `?`; vale a mais restritiva). Ex.: `negar write_file config/*`, `perguntar shell git push*`. Comandos perigosos no `shell` (`rm -rf /`, `curl | sh`, `git push --force`, `git reset --hard`, `chmod 777`, `dd`…) sempre pedem confirmação, mesmo no modo Auto.
- **Hooks:** `.codemobile/hooks.txt`, linhas `antes|depois <ferramenta> [padrão] => bloquear|avisar: mensagem`. Ex.: `depois write_file *.js => avisar: rode check_preview`.
- **Validação de argumentos:** número escrito como texto vira inteiro, objetos viram texto, `edits` malformado volta como erro claro para o modelo corrigir.
- **Memória do projeto:** ferramentas `memory_add`, `memory_list`, `memory_remove` guardam anotações duráveis em `.codemobile/memoria.md`, injetadas no prompt (até 2 mil caracteres; não entram no modo conversa). Comando `/memoria`, `/memoria + texto`, `/memoria - número`.
- **Sub-agentes com papel:** `spawn_agent` aceita `tipo`: `explorar`, `revisar` ou `planejar`.
- **Comando `/regras`:** cria os modelos comentados de regras e hooks e mostra quantos estão ativos.

Limites (honesto): o agente não consegue alterar `regras.txt` e `hooks.txt` pelas ferramentas de arquivo, mas um comando de `shell` no Linux/Termux roda fora dessa checagem; as regras valem para o nome da ferramenta e o primeiro argumento de texto. Hooks `depois` + `bloquear` são ignorados (a ferramenta já rodou).


## Pacotes: APK, EXE, ZIP e qualquer arquivo (pkg.js)
Não existem mais menus separados por tipo de arquivo. **＋ → Adicionar arquivo** aceita qualquer coisa; APK, AAB, JAR, ZIP, DOCX, EXE, DLL, DEX, SO e binários em geral viram uma pasta do projeto em `pacotes/<nome>/`, e todo o resto é igual a qualquer outro arquivo.

- **Legível:** o `AndroidManifest.xml` e os XMLs binários do Android aparecem como texto editável; imagens, textos e o ZIP embutido de um EXE viram arquivos; o que é binário grande fica dentro do pacote e é lido sob demanda.
- **Edição:** com a IA (ferramentas normais `read_file`, `edit_file`, `grep` e as `pkg_*`: `pkg_list`, `pkg_info`, `pkg_find`, `pkg_hex`, `pkg_strings`, `pkg_patch`, `pkg_replace`, `pkg_replace_image`, `pkg_extract`, `pkg_remove`) ou à mão, na aba Arquivos.
- **Recompilar:** `pkg_build` (a IA) ou ＋ → Pacotes. APK sai assinado com a chave guardada no aparelho; XML inválido ou imagem que não cabe no espaço original voltam como erro claro, nunca um arquivo quebrado.
- Os editores antigos (`apk.js`, `apkplug.js`, `exe.js`, `exe2.js`) deixaram de ser carregados; os arquivos continuam na pasta e podem ser apagados quando você quiser (`test/exe.test.mjs` ainda testa o `exe2.js`).
- `node --test test/carga.test.mjs` carrega todos os scripts do `index.html` juntos e falha se um nome for declarado em dois arquivos (isso derrubaria o app inteiro).


## Modelos reserva (reserva.js)
**Ajustes → 🔁 Modelos reserva.** Monte uma lista ordenada de provedores (Claude, OpenAI, Gemini, Groq, OpenRouter, DeepSeek, Mistral, xAI, Together, Ollama/personalizado). Se o principal bater o limite, ficar sem crédito, recusar a chave ou cair, o app troca sozinho para o próximo e continua a tarefa de onde estava; avisa na barra de status.
- Cada reserva usa a **própria chave e o próprio modelo** (os mesmos campos que você já usa por provedor); nenhuma chave vai para arquivo do projeto.
- Castigo do principal: ~3 min em limite por minuto/sobrecarga, ~30 min em cota/crédito, ~2 h em chave inválida. Passado o castigo, o app volta sozinho ao principal (ou toque em "voltar agora").
- Erros de pedido (contexto grande demais, política de conteúdo) **não** trocam de provedor, porque outro provedor não resolveria; o botão de parar do usuário também não dispara troca.
- Enquanto uma reserva está ativa, o modelo "rápido/profundo" do principal fica de lado e volta junto com ele.
- Limite honesto: a troca altera o provedor ativo dos Ajustes (assim as chamadas em paralelo ficam coerentes); se você escolher outro provedor à mão, o app esquece a troca automática.

## Pasta do aparelho
- **Seleção:** ＋ → 📂 Pastas conectadas. No APK usa o plugin nativo (`native/FolderPlugin.java`); em navegador/PWA usa o File System Access.
- **O que importa:** só texto (até 600 arquivos, 300 KB cada). Tudo o que ficou de fora (binários, grandes, excesso) agora é listado em `importados/<pasta>/_ignorados.txt`, e continua intacto na pasta real. Esse arquivo não conta como alteração ao salvar.
- **O build avisa:** o passo "O que entrou no APK" do GitHub Actions mostra se `FolderPlugin`/`ShellPlugin` e os scripts novos estão dentro do APK. Se o plugin de pasta foi descartado, o app agora diz isso em vez de "não dá para escolher pasta".
- `FolderPlugin.java` foi compilado contra stubs fiéis das APIs do Android/Capacitor com o `javac` do JDK 21 (compila sem erros), mas **não foi testado num aparelho**.
- **Ainda não faz:** abrir binários (APK, EXE, DLL, assets de jogo) direto da pasta. Para isso, hoje, importe o arquivo avulso por ＋ → Adicionar arquivo (vira `pacotes/`).

## Linux embutido (proot) — básico
Ao abrir a aba ⌨️ Terminal pela primeira vez, o app oferece instalar o Linux (Alpine via proot). Depois da extração ele faz um teste real (`proot` iniciando um `/bin/sh`); se falhar, mostra a saída do erro e apaga a instalação incompleta. Já instalado, o botão **🔧 Reparar / reinstalar** apaga e instala de novo. O terminal usa o Linux automaticamente quando ele está pronto (o mini-terminal continua como reserva).

## Trazido do opencode (MIT)
- **`apply_patch`**: o agente edita vários arquivos de uma vez com um patch (Add/Update/Delete/Move, com contexto). Tolera espaços e aspas tipográficas e é atômico: se um trecho não for achado, nada muda.
- **`glob`**: achar arquivos por padrão (`src/**/*.js`, `**/*.{html,css}`).
- **Regras de permissão por padrão** em `codemobile.json` na raiz (a última regra que casar vence; ações `allow`, `ask`, `deny`):
  `{"permission":{"shell":{"*":"ask","git *":"allow","rm *":"deny"},"edit":{"dist/**":"deny"},"read":{"secrets/**":"deny"}}}`.
  Por padrão `.env`, `.env.*`, `id_rsa*` e `*.pem` não podem ser lidos pelo agente. Mexer em `codemobile.json` sempre pede confirmação.
- **Instruções por pasta**: ao ler/editar um arquivo, o `AGENTS.md`/`CLAUDE.md` mais próximo (nas pastas acima dele) é anexado ao resultado, uma vez por conversa.


## Provedores de IA (grátis e outros)

Ajustes → **Provedor** lista ~36 provedores em 4 grupos (🆓 grátis, 🎁 créditos de teste, 💳 pagos, 🏠 local). Cada um mostra uma dica de como obter a chave, um botão que abre a página da chave e modelos sugeridos (até você tocar em "Buscar modelos").
- **Grátis:** Gemini, Groq, OpenRouter (modelos `:free` aparecem primeiro), **NVIDIA NIM**, **Cloudflare Workers AI** (preencha o Account ID), Cerebras, GitHub Models, Hugging Face, Mistral/Codestral, Zhipu e Z.ai (GLM-flash), SiliconFlow, ModelScope, Ollama Cloud.
- **Sem chave e sem cadastro:** LLM7.io, OVHcloud (anônimo), Kilo Gateway, Pollinations. Local: Ollama e LM Studio (use o IP do PC na URL).
- **Créditos de teste:** SambaNova, Cohere (trial), Alibaba Qwen/DashScope, Fireworks, Hyperbolic, DeepInfra, Novita, Scaleway, Chutes.
- Dá para usar vários ao mesmo tempo como **modelos reserva**: quando um bate o limite grátis, o app troca para o próximo.
Os limites grátis mudam com frequência; confira na página de cada provedor. O agente precisa de um modelo com suporte a chamadas de ferramenta (tool calling); modelos pequenos ou do Pollinations costumam falhar nisso. Para adicionar outro provedor compatível com a API da OpenAI, edite `www/provedores.js` (uma linha) ou use "Personalizado".


## Modelos locais (rodam no aparelho)

Ajustes → provedor **Modelo local** → seção **🧠 Modelos locais**. Catálogo só de modelos pequenos (GGUF, do Hugging Face): 🟢 *muito fracos* (SmolLM2 135M/360M, Qwen2.5 0.5B), 🟡 *fracos* (Llama 3.2 1B, Gemma 3 1B, Qwen2.5 1.5B) e 🟠 *médios* (Qwen2.5 Coder 1.5B, Gemma 2 2B, Qwen2.5 3B). Toque em **Baixar** (use Wi-Fi), depois **Usar este modelo**; **Testar** mostra a velocidade e **Apagar** remove o arquivo. Dá para adicionar outro `.gguf` por URL.
- Motor: [wllama](https://github.com/ngxson/wllama) (llama.cpp em WebAssembly), CPU, sem GPU. O build do APK embute a biblioteca em `www/llm/` (passo opcional do workflow); sem isso o app a baixa da CDN jsDelivr na 1ª vez. Para trocar a versão/origem: `S.llm.lib` (URL do `esm/index.js`).
- O app fala com o modelo local por um servidor "virtual" interno (`http://cm-local.invalid/v1`): agente, modelos reserva e contador de custo funcionam como nos outros provedores. As chamadas de ferramenta são feitas por texto (`<tool_call>…</tool_call>`) com um prompt compacto; modelos desse tamanho erram bastante nelas.
- Expectativa realista: celular médio roda os "muito fracos" a poucas palavras por segundo e os "médios" bem mais devagar; modelos maiores que ~1,5 GB podem travar o app em aparelhos com pouca RAM. Para modelos maiores e mais rápidos, rode o Ollama no Termux ou no PC e use o provedor **Ollama**.

## Conectar pasta (se o seletor não abrir)
- **APK com plugin nativo**: abre o seletor do Android (SAF). Se o plugin faltar, o app mostra o diagnóstico exato (e o passo "O que entrou no APK" do GitHub Actions confirma).
- **Chrome desktop**: usa o seletor do navegador.
- **Termux / navegador no celular** (sem seletor): o app abre um seletor de pastas próprio, via servidor (`/api/ls`, `/api/dirread`, `/api/dirwrite`). Restrito ao HOME, `/storage` e `/sdcard`; precisa de `termux-setup-storage` para ver o armazenamento do celular.


## Projeto Android com Gradle (pasta `android/`)
O projeto Capacitor 6 já vem pronto, com Gradle Wrapper (Gradle 8.2.1, AGP 8.2.1, JDK 17), sem precisar de `npx cap add android`.
```
npm install              # baixa @capacitor/android e @capacitor/preferences (usados pelo Gradle)
npm run android:build    # copia www/ para o app e roda ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```
Ou abra a pasta `android/` no Android Studio. No GitHub, o workflow `Build APK` usa a mesma pasta.
Plugins nativos opcionais: `bash native/setup-linux.sh` (Linux embutido) e `bash native/setup-folder.sh` (pasta); a pasta já vem com o `FolderPlugin`.

## Pesquisa na web sem CORS
O navegador bloqueia (CORS) a busca direta em buscadores. Agora a busca do agente tenta, nesta ordem:
1. **Servidor** (`sh start.sh`): `GET /api/search?q=...` (DuckDuckGo → Wikipedia, feito no servidor) e `/api/fetch` para páginas;
2. **HTTP nativo do APK** (CapacitorHttp, não sofre CORS);
3. `fetch` direto e, por último, o proxy leitor (se ativado).
O servidor também detecta `java`, `javac`, `gradle` e `kotlinc` em `/api/caps`.

## Executar de verdade, em muitas linguagens (modulos/execucao.js)
O botão **Executar** e a ferramenta `run_file` agora usam o **Linux real** do app (Alpine via proot) ou o Termux quando eles estão ativos; sem Linux, tudo continua funcionando no navegador como antes.
- **Linguagens (27):** Python, JavaScript (Node), TypeScript, Java, Kotlin, Go, Rust, C, C++, C#, Ruby, PHP, Lua, Perl, R, Bash, SQL (SQLite), Elixir, Haskell, Nim, Zig, OCaml, Fortran, COBOL, D e Tcl. `cm langs` mostra o que já está instalado.
- **Instala sozinho o que faltar:** se o compilador não existe, o app instala (apk no Alpine, pkg no Termux) e roda. No modo Ask/Edits ele pergunta antes; no modo Auto, não.
- **Dependências:** `requirements.txt`/`pyproject.toml` (venv por projeto, com `--system-site-packages`), `package.json` (npm), `go.mod`, `Cargo.toml` (cargo), `pom.xml` (Maven) e `build.gradle`, `Gemfile`, `composer.json`, `mix.exs`. O carimbo do arquivo evita reinstalar a cada execução. Se o código der `ModuleNotFoundError`/`Cannot find module`, o app instala o pacote certo (ex.: `cv2` → `opencv-python-headless`, `PIL` → `pillow`) e roda de novo, até 6 vezes, sem repetir o mesmo pacote.
- **Comandos:** `cm run ARQUIVO [--input "texto"]`, `cm deps`, `cm langs`, `cm install <linguagem>` (ex.: `cm install kotlin`). A IA ganhou a ferramenta `install_deps` (projeto inteiro ou pacote avulso: pip, npm, apk, gem, composer, go).
- **Sem Linux (só navegador):** Python agora instala pacotes puros do `requirements.txt` e dos imports que faltarem via micropip (pacotes com código nativo precisam do Linux).
- **Limites honestos:** não foi testado num aparelho; os scripts foram validados com `sh -n` para todas as linguagens e executados de verdade (Python, Node, C, C++, Perl, Bash) no `npm test`. Swift, Dart e Julia não têm pacote no Alpine/Termux: continuam só via executor remoto (Ajustes). O Kotlin no Alpine vem do zip oficial do GitHub (JetBrains), sem checksum fixado. Nomes de pacote vêm do código/da IA: no modo Auto o app instala sem perguntar, então use Ask se não confia no projeto.

## 🆓 Modelos grátis (modulos/modelos.js, scripts/modelos-gratis.mjs)
**＋ → 🆓 Modelos grátis** (ou digite `/gratis`). Duas abas:
- **OpenRouter · ao vivo:** lista os modelos de custo zero (API pública, sem chave) com contexto, ferramentas, imagens e raciocínio. Filtros e busca; **Usar este modelo** já define provedor e modelo. O agente precisa de ferramentas, então 🛠 vem ligado. O OpenRouter exige uma chave (grátis) mesmo para esses modelos.
- **Outros provedores:** Groq, Gemini, Cerebras, NVIDIA, LLM7 etc. com a dica de cada um, botão de chave e **Usar**.
- **De onde vêm os dados (nesta ordem):** servidor (`GET /api/models/free`, com cache de 30 min em memória e em disco) → OpenRouter direto (no APK, HTTP nativo, sem CORS) → `www/free-models.json` (cópia salva). Essa cópia começa **vazia** e é preenchida pelo workflow abaixo.

## Workflows (GitHub Actions)
- **Build APK** (a cada push em main ou manual): injeta os módulos, roda os testes, gera o APK com a rede de proteção de plugins e publica em **Releases → latest → CodeMobile.apk** (download direto do `.apk`, sem ZIP; além do artefato de sempre).
- **Atualizar modelos grátis** (todo dia 06:17 UTC ou manual): roda os testes, baixa a lista e faz commit de `www/free-models.json` só se mudou (`[skip ci]`, não dispara outro build). Agendamentos do GitHub pausam após 60 dias sem atividade no repositório.
- **Testes** (em pull requests ou manual): confere que o `index.html` tem os módulos atuais e roda `npm test`.
- Os módulos ficam em `modulos/*.js` e são colocados dentro do `index.html` por `node scripts/injetar-modulos.mjs` (`npm run modulos`; `--check` só confere). Depois de editar um módulo, rode o comando e envie também o `index.html` (e `android/.../public/index.html`, que o script atualiza).
