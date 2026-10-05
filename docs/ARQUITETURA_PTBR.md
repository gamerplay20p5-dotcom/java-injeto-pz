# Arquitetura e Explicação do Código

## Escolha Técnica

Electron fornece a janela desktop e os diálogos Windows. React organiza a interface, Lucide fornece os ícones e Vite compila os arquivos locais. O processo principal faz operações de arquivos; a interface não recebe Node.js, shell ou acesso arbitrário ao computador.

Não existe injeção em processo alheio já aberto. O launcher inicia uma JVM nova do PZ com argumentos `-javaagent` conhecidos. Isso evita substituir o JAR vanilla, instalar classes avulsas ou copiar DLLs de mods. O Java utilizado é sempre `jre64/bin/java.exe` dentro da instalação validada do jogo.

## Mapa dos Arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `catalog.json` | Componentes permitidos, Workshop IDs, caminhos de JAR, classe premain e dependências. Não contém arquivos dos mods. |
| `src/main/catalog.cjs` | Valida o catálogo; recusa caminhos que escapem de pastas, comandos extras, IDs duplicados e dependências circulares. |
| `src/main/discovery.cjs` | Detecta Steam/bibliotecas, valida o cliente e encontra JARs por estrutura e `mod.info`. |
| `src/main/jar.cjs` | Abre o ZIP/JAR, lê o manifesto principal, valida Premain-Class e calcula SHA-256. |
| `src/main/files.cjs` | Caminhos contidos, leituras limitadas, hash por stream, JSON atômico e inspeção de classes antigas. |
| `src/main/profile.cjs` | Valida preferências, resolve dependências, cria revisão, prepara cópias e monta os argumentos da JVM. |
| `src/main/steam-auth.cjs` | OpenID Steam no navegador, callback loopback e confirmação de assinatura no endpoint oficial. |
| `src/main/index.cjs` | Janela, protocolo local, IPC autorizado, estado da interface, operações exclusivas e processo Java. |
| `src/preload.cjs` | Ponte com métodos específicos; não expõe ipcRenderer, sistema de arquivos ou execução de comandos. |
| `src/renderer/main.jsx` | Biblioteca, configurações, atividade, privacidade, modais e tratamento de erros em PTBR. |
| `src/renderer/styles.css` | Temas, dimensões responsivas, foco, estados e redução de animações. |
| `tests/*.test.cjs` | Regressões de catálogo, arquivos, perfis, parâmetros Windows e OpenID. |
| `tools/verify-ui.cjs` | Teste desktop Playwright/Electron, screenshots e preparação real isolada. |
| `tools/verify-agents.cjs` | Teste dos agentes reais copiados, sem iniciar a partida. |

## Busca de Arquivos

`steamPaths()` consulta apenas o caminho Steam no Registro e `libraryfolders.vdf`. O VDF é interpretado com um parser, incluindo bibliotecas antigas. Não lemos `loginusers.vdf`, cookies, credenciais ou configurações de contas Steam.

`validateGame()` verifica os três arquivos mínimos e a classe principal `zombie/gameStates/MainScreenState`. Uma configuração de servidor dedicado é recusada.

`modRoots()` visita diretórios estruturais com profundidade máxima seis e orçamento de 1.800 diretórios por raiz. Pula árvores pesadas de `media`, modelos, mapas, bibliotecas e ferramentas. A busca acontece ao abrir ou por solicitação; não fica examinando o disco continuamente.

Prioridade: seleção manual do JAR de um agente, Workshop conhecida nas bibliotecas Steam, Workshop local de desenvolvimento e pastas adicionais. A biblioteca Steam escolhida explicitamente tem prioridade sobre a detectada no Registro. Se algo não for encontrado, há uma busca estrutural limitada por Mod ID nos outros itens da Workshop, inclusive para publicações cujo número ainda não está no catálogo. O limite de oito pastas adicionais evita uma varredura ilimitada. Mods não encontrados podem ser selecionados explicitamente.

## JAR e Validação

`safeJar()` resolve o caminho real e exige arquivo regular `.jar`, de 22 bytes até 128 MiB. `inspectJar()` valida o manifesto e, para agentes, a classe premain exata do catálogo e a existência de seu `.class` dentro do ZIP.

O manifesto pode ter até 4 MiB: o ZombieBuddy assinado contém aproximadamente 1,1 MiB de seções com resumos por classe. Só a seção principal define Premain-Class; continuações de linha seguem o formato JAR. Essa leitura não executa Java.

O hash é calculado por stream, não carregando todo o arquivo outra vez para produzir SHA-256. A biblioteca ZIP ainda precisa analisar o JAR em memória, portanto o limite de tamanho é importante. Não afirmamos que um JAR aceito seja seguro: um arquivo malicioso também poderia declarar a classe esperada.

## Revisão e Preparação

`dependencies()` retorna dependências em ordem, sem duplicar agentes. Viewpoint inclui ZombieBuddy; não força ZombieBuddy para Skinwalker.

A ordem vem do catálogo e das dependências, não da ordem dos cliques. Skinwalker entra antes de ZombieBuddy: o segundo aquece/carrega `LuaManager$Exposer` em premain, e o primeiro precisa instalar seu transformador antes desse carregamento. `launchPlan()` também reordena um manifesto válido pela ordem canônica. Não inverter as entradas do catálogo sem testar hooks e inicialização.

`Profiles.review()` gera um token aleatório, com validade de cinco minutos, associado ao hash das configurações e dos arquivos. Retorna origem, destino, nomes e avisos para confirmação visual.

`Profiles.apply()` verifica esse token e revalida os hashes. Agentes são copiados para:

```text
%APPDATA%\Java Injeto - PZ\
  settings.json
  prepared.json
  runtime\
    <sha256>\SkinwalkerAgent.jar
    <sha256>\ZombieBuddy.jar
```

Uma cópia é escrita em arquivo temporário exclusivo, verificada e renomeada. O manifesto só é publicado após todas as cópias necessárias. Não há execução de JAR durante a preparação. Uma falha pode deixar cópias sem referência, mas não publica um perfil parcial. Remover JARs apaga o diretório runtime próprio e o manifesto, nunca a Workshop.

Viewpoint não é copiado: o perfil registra seu caminho/hash e o framework o carrega pela estrutura original do mod quando está ativo. Copiar só seu JAR não bastaria para instalar o mod.

## Inicialização

`windowsArgs()` escolhe a seção Windows do JSON vanilla por comparação numérica de versões. `commandFor()` preserva classpath e argumentos normais, usa memória vanilla por padrão e acrescenta apenas os agentes aprovados. Não modifica esse JSON no disco.

Agentes antigos conhecidos no JSON são removidos somente do plano em memória para evitar duplicação. Um agente desconhecido bloqueia o plano para revisão. Classes avulsas no diretório `zombie` também bloqueiam sem exclusão; uma pasta vazia é aceitável. A inspeção de classes tem orçamento de 1.000 diretórios e bloqueia árvores excessivas ou links simbólicos para não seguir caminhos desconhecidos.

`launchPlan()` revalida origem e cópia e devolve o comando para outra confirmação de até dois minutos. `launch` recalcula esse plano; divergências exigem revisão. O processo usa `spawn` com vetor de argumentos e `shell:false`, evitando transformar espaços em comandos de shell.

O PATH deste processo começa por `jre64/bin` e `win64` do PZ. Variáveis genéricas de injeção JVM, `JAVA_TOOL_OPTIONS`, `JDK_JAVA_OPTIONS` e `_JAVA_OPTIONS`, não são herdadas pelo processo do jogo. Nenhuma configuração global é alterada. ZombieBuddy recebe `policy=prompt`; aprovações de mods continuam sendo responsabilidade dele.

O launcher acompanha apenas o processo iniciado por ele e seu código de saída. Não monitora comandos de outros processos, não captura stdout/chat do jogo e não envia diagnósticos automaticamente. Portanto, feche instâncias abertas por outros atalhos antes de usar o launcher.

## Isolamento da Interface

A janela usa `contextIsolation:true`, `sandbox:true`, `nodeIntegration:false` e `webSecurity:true`. O conteúdo vem de `organic://launcher`, com CSP restrita, sem navegação externa, iframes ou permissões de microfone/câmera. Novas janelas são bloqueadas.

Cada IPC valida a janela, o frame principal e a URL local. Métodos aceitam somente ações específicas, IDs do catálogo e configurações validadas. Não existe IPC de executar PowerShell, de escrever um arquivo arbitrário ou de abrir qualquer URL fornecida pela interface.

`exclusive()` serializa operações de arquivos e impede preparação/remoção enquanto o processo do jogo conhecido está ativo. A atividade fica limitada a 60 eventos em RAM.

## OpenID Steam

`SteamAuth.start()` cria nonce/estado aleatório e servidor HTTP apenas em `127.0.0.1`, com porta aleatória e prazo de cinco minutos. O navegador recebe a URL do endpoint oficial Steam.

O retorno exige estado correspondente, Host local, parâmetros sem duplicação, identidade Steam válida, return_to exato e campos assinados obrigatórios. O nonce deve ser recente. `verifyAssertion()` envia check_authentication para um endpoint Steam fixo, sem aceitar redirects, e exige assinatura confirmada. Há limite de 8 KiB para resposta e timeout de dez segundos.

Sucesso encerra o listener e mantém somente SteamID em RAM. Cancelar, expirar, desconectar e fechar descartam o estado. O SteamID é exposto à interface apenas para informar a sessão. Não é incluído nos arquivos de preferências ou exportação.

O login não substitui a Steam aberta, não usa chave Web API e não concede acesso a um servidor privado. Um futuro controle de acesso online exigiria outra arquitetura e uma política de dados separada.
