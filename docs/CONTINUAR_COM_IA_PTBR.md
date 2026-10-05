# Continuação do Projeto com IA

## Pedido Original e Limites

Criar Java Injeto - PZ para desktop Windows, interface PTBR e foco Organic. Preparar somente JARs; os mods são baixados normalmente pela Workshop. Não copiar Lua, modelos, `.class` soltas, DLLs de mods ou sobrescrever arquivos vanilla. Steam login opcional pelo navegador, sem persistir credenciais/dados de conta. Não criar backend, sistema de telemetria ou login falso.

Pasta de desenvolvimento original: `%USERPROFILE%\Desktop\Launcher - Organic`. Em um clone público, use a raiz escolhida para `java-injeto-pz`; não dependa de um nome de usuário Windows específico.

## Já Implementado

- Electron + React + Vite, interface local, filtros, busca, temas, animações reduzidas e modais de consentimento.
- Catálogo Skinwalker, Viewpoint e ZombieBuddy com validação de campos/caminhos/dependências.
- Descoberta Steam por Registro e VDF, seleção manual e busca estrutural limitada.
- Hashes, manifesto premain, cópias somente JAR, preparo revisável e remoção restrita.
- Inicialização via Java bundled do PZ, sem alterar JSON/Steam/Workshop.
- Viewpoint permanece na estrutura original e depende do ZombieBuddy; não é um agente independente.
- Login OpenID real implementado; resposta Steam é validada no endpoint oficial. Testes de assinatura usam mock; login com conta real ainda pendente.
- Histórico em RAM, exportação manual sem SteamID e bloqueio de conteúdo externo/IPC não autorizado.
- 38 testes unitários, teste Electron real, aplicativo Windows empacotado e três testes de entrada de agentes na JVM.

## Referências Locais

```text
%USERPROFILE%\Zomboid\Workshop\Skinwalker\Contents\mods\Skinwalker\42\media\java\SkinwalkerAgent.jar
<biblioteca Steam>\steamapps\workshop\content\108600\3809306528\mods\Viewpoint
<biblioteca Steam>\steamapps\workshop\content\108600\3619862853\mods\ZombieBuddy
<biblioteca Steam>\steamapps\common\ProjectZomboid
```

Não presuma esses caminhos em outros computadores: descoberta e seleção manual já são a estratégia. Skinwalker ainda usa Workshop ID nulo no catálogo, por não ter uma publicação confirmada.

Skinwalker premain: `io.duckstudio.skinwalker.Agent`, protocolo atual 0.3.0. ZombieBuddy premain: `me.zed_0xff.zombie_buddy.Agent`, instalado 2.3.4. Viewpoint instalado 0.1.5a-hotfix; Workshop 3809306528. A referência do game é B42.21; não usar Umbrella .20 para afirmar APIs atuais sem verificar.

## Cuidados Aprendidos

- O manifesto assinado ZombieBuddy possui 1.140.461 bytes; o limite antigo 64 KiB era incorreto. Agora há limite 4 MiB e teste de regressão.
- Viewpoint tem mod.info em `common`, não necessariamente em `42`; a descoberta aceita ambos.
- Pastas `zombie` vazias não são classes conflitantes. Bloqueie arquivos `.class`, links ou árvores excessivas, sem remover arquivos do usuário.
- Esquemas URL personalizados podem ter `.origin` igual a `null` em Node. Validação de IPC usa protocolo, hostname, caminho e frame diretamente.
- Javaagent funciona em caminho absoluto com espaços quando `spawn` recebe argumentos separados. Não monte string de shell.
- ZombieBuddy exige preservar aprovações. Nunca trocar policy por allow-all para esconder problemas.
- A ordem dos agentes é canônica: Skinwalker antes de ZombieBuddy. O segundo aquece Exposer em premain; inverter pode impedir o hook Skinwalker. Não depender da ordem dos cliques.
- O login não restringe acesso ao servidor e não comprova propriedade do jogo.
- `test:ui` não pode chamar confirmação final de iniciar jogo ou login real automaticamente.
- Somente dados temporários isolados podem ser apagados pelos testes; preserve saves e arquivos originais.

## Próxima Etapa Recomendada

Comece pela homologação manual descrita em TESTES_PTBR, não por aumentar o catálogo. Teste abertura vanilla, agentes separados, combinação e MP. Investigue qualquer incompatibilidade Java com logs do jogo fornecidos pelo usuário, sem coletar conversas ou voz automaticamente.

Depois avalie assinatura de código do executável, distribuição de hashes, revisão de licenças e suporte a mais agentes. Atualizações automáticas exigiriam manifesto assinado, verificação do editor e análise própria de segurança; ainda não existem.

Não alegue que logs de teste `premain` comprovam renderização/VOIP/MP. Não prometa ausência de riscos de terceiros ou save indestrutível. Nenhum segredo/chave Steam deve ser colocado no catálogo ou fonte.

## Comandos de Retomada

```powershell
npm ci
npm test
npm run build
npm run test:ui
npm run test:agents
npm run dist
```

Leia ARQUITETURA_PTBR e NOVOS_AGENTES_PTBR antes de editar serviços de preparação/execução. `npm run dev` é só prévia no navegador; para testar IPC use Electron.

## Publicação Open Source

Repositório: https://github.com/gamerplay20p5-dotcom/java-injeto-pz. Código próprio sob licença MIT; dependências e mods continuam com seus autores. `README.md` é a apresentação pública; `README_PTBR.md` mantém o manual completo.

O CI usa Windows e Node 24 para `npm ci`, `npm test` e `npm run build`, sem arquivos do jogo, agentes ou credenciais. Releases podem distribuir somente o launcher e seu hash, nunca mods ou gravações. Não faça commit de `release`, `test-results`, `node_modules`, dados locais ou segredos.
