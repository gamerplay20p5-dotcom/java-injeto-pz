# Manual do Java Injeto

## Para Que Serve

Utilitário local, **não um iniciador do jogo**, para configurar agentes Java dos mods conhecidos. A revisão de JARs e cópia com hash existentes foram preservadas; a versão 0.2 adiciona ativação reversível no JSON, interface compacta Duck e Otimizador C#.

O aplicativo não baixa mods nem instala Java global. Baixe e ative os mods normalmente pela Workshop. Login Steam é opcional e não controla acesso ao servidor.

## Passo a Passo

1. Baixe o **Setup.exe** nas [releases](https://github.com/gamerplay20p5-dotcom/java-injeto-pz/releases/latest) e conclua o assistente PTBR. Abra **Java Injeto** pelo atalho com o PZ fechado. Para uso portátil, execute `Java Injeto.exe`, na raiz desta pasta, ou o portátil em `release/`.
2. Clique em **Verificar pastas**. A pasta do jogo deve conter `ProjectZomboid64.json`, `projectzomboid.jar` e `jre64/bin/java.exe`.
3. Quando necessário, vá a **Configurações > Pastas** e selecione o jogo ou a biblioteca Steam. Use **Adicionar pasta** para mods em uma localização diferente.
4. Em **Mod JAR** ou **Início**, selecione os componentes. Viewpoint inclui ZombieBuddy automaticamente.
5. Clique em **Revisar JAR**, confira origem, SHA-256, manifesto e destinos. Marque a autorização e escolha **Preparar JARs**.
6. Clique em **Injetar agora**. A confirmação mostra o JSON do jogo e a pasta do backup. Autorize a alteração local.
7. Depois de **Java posicionado com sucesso**, o aplicativo pode ser fechado. Abra o jogo pela Steam, não por este utilitário.

Preparação apenas copia e valida. **A injeção é uma segunda etapa** que grava a configuração; preparar não ativa agentes sozinho. Não coloque `Viewpoint.jar` diretamente em `-javaagent`: ele depende do carregamento pelo ZombieBuddy e do mod completo ativo.

## Destinos e Backup

```text
%APPDATA%\Java Injeto - PZ\
  settings.json                Preferências locais
  prepared.json                Fontes, destinos e hashes dos JARs
  injection.json               Registro da injeção e backup atual
  runtime\<SHA-256>\*.jar       Cópias isoladas de agentes
  backups\<identificador>.json  Cópia integral do JSON original
  optimizer\                   Estado da sessão nativa, sem histórico crescente
  native-runtime\<SHA-256>\     Auxiliar próprio, persistente após fechar o portátil
```

Na pasta do jogo, apenas `ProjectZomboid64.json` é alterado com consentimento. JAR vanilla, JVM, saves, DLLs e mods ficam intactos. Destinos reais aparecem no painel; não se presume que todo componente pertença a `media/java`.

Para reverter, feche o jogo e use **Backup > Restaurar backup**. O JSON volta aos bytes originais. Depois, **Remover cópias Java** permite apagar somente o runtime do utilitário. A remoção é bloqueada enquanto houver referências ativas ou configuração alterada externamente.

Se uma atualização Steam ou edição manual mudar o JSON, a ferramenta não o sobrescreve automaticamente. Preserve a configuração atual e o backup e revise as diferenças. Não apague backups para contornar essa proteção. Antes de mover/remover a pasta de dados do aplicativo, restaure a instalação: os agentes são referenciados por caminho absoluto.

Backups anteriores permanecem disponíveis na pasta própria. São pequenos arquivos JSON; não há limpeza automática que possa apagar seu original.

## Atualização dos Mods

Quando um JAR mudar, clique em **Verificar pastas** e revise, prepare e injete novamente. O backup original não é substituído pela configuração já injetada.

JAR manual escolhido nos detalhes tem prioridade. **Usar busca automática** desfaz essa escolha. Viewpoint usa a pasta de mod, não um JAR isolado. Classes `.class` antigas na pasta `zombie` e agentes desconhecidos no JSON bloqueiam aplicação, sem exclusão de arquivos.

SHA-256 detecta divergências, mas não comprova autoria ou segurança. O manifesto informa estrutura/premain. A assinatura não é validada criptograficamente; o programa não oferece um selo de baixo risco para código de terceiros.

## Otimizador

A aba **Otimizador** detecta hardware e permite escolher Equilibrado, Desempenho ou Econômico. Memória automática recomenda um limite com reserva para Windows e memória nativa. **Aplicar configuração JVM** abre a revisão e cria backup; nunca inicia o jogo.

Prioridade, energia e monitoramento são opções de sessão. Selecione as desejadas e clique em **Ativar em segundo plano**. Abra o PZ pela Steam por conta própria. Pode fechar a interface: o auxiliar C# permanece sem CMD e restaura alterações temporárias ao terminar a partida. Ele expira após 30 minutos sem jogo detectado.

**Restaurar sessão** interrompe o auxiliar e recupera o plano de energia. **Restaurar padrão** redefine preferências e pode restaurar o JSON original, desativando também os agentes; isso é avisado antes da confirmação. Não altera mods da Workshop.

Redução seletiva lista somente aplicativos permitidos com janela aberta. Cada fechamento exige escolha e confirmação. Não força encerramento: salve documentos e aceite eventuais perguntas do próprio aplicativo. [Manual detalhado do Otimizador](docs/OTIMIZADOR_PTBR.md).

## Atalho e Executável

O instalador cria atalhos no menu Iniciar e na área de trabalho. O ícone superior **Criar atalho na área de trabalho**, também disponível em Configurações, cria `Java Injeto.lnk` apontando para o aplicativo instalado ou o portátil atual. **Localizar executável** abre a pasta dele. Se mover o portátil, crie o atalho novamente. Não é um atalho para abrir o PZ.

O arquivo possui o ícone Duck incorporado. O executável ainda não tem certificado de assinatura Windows; verifique a procedência, não desative antivírus.

Para atualizar a instalação, feche o utilitário e execute o novo Setup. Preferências e backups são mantidos. Para remover, primeiro restaure a injeção e a sessão do Otimizador pelo aplicativo e depois desinstale em **Configurações do Windows > Aplicativos**. AppData é preservado, inclusive cópias Java ainda usadas pelo jogo. [Manual do instalador](docs/INSTALACAO_PTBR.md).

## Steam e Privacidade

Em **Sobre**, o login opcional abre o navegador em `steamcommunity.com`. Não há campos de senha, Steam Guard ou chave de API no aplicativo. SteamID fica apenas em RAM; autenticação não confirma propriedade do jogo nem concede acesso ao servidor. [Documentação Steam](https://partner.steamgames.com/doc/features/auth).

Dados locais incluem preferências, caminhos, hashes e backups. O utilitário não grava VOIP. Recursos de voz de Skinwalker pertencem ao mod, com política própria. Diagnóstico só é exportado por comando explícito e pode revelar o nome de usuário Windows nos caminhos.

## Problemas Comuns

| Situação | O que conferir |
| --- | --- |
| Pasta não encontrada | Selecione a instalação completa do cliente Windows, não o dedicado. |
| JAR não encontrado | Verifique o download; selecione pasta adicional ou Localizar JAR nos detalhes do agente. |
| Preparado, mas agente não carrega | Falta a etapa Injetar agora; confirme também os mods ativos dentro do jogo. |
| Viewpoint não funciona | Mantenha mod completo, ZombieBuddy ativo e aprovações `policy=prompt`. |
| Falha de escrita | Feche o PZ; confirme permissões da pasta e eventual bloqueio pelo antivírus. Não execute como administrador por padrão. |
| Configuração alterada externamente | Preserve atual e backup; revise diferenças antes de restaurar. |
| Monitor interrompido | Use Restaurar sessão para recuperar energia antes de reativar. |
| Jogo falha depois da injeção | Restaure backup, teste vanilla e compare agentes isoladamente com o `console.txt` do PZ. O utilitário não acompanha a partida. |
| Login não volta | Confira domínio oficial, navegador e relógio; a solicitação expira em cinco minutos. |

## Para Desenvolver

Use Windows x64, Node 24 e o compilador C# do .NET Framework.

```powershell
npm ci
npm test
npm start
npm run test:ui
npm run test:agents
npm run dist
npm run test:package
node tools/verify-portable.cjs
npm run test:installer
```

`test:ui` e `test:package` usam jogo e JARs fictícios em diretórios temporários. Não escrevem na instalação real. `test:agents` usa o Java e agentes reais somente em probe `-version`; exige os componentes locais. `npm run dev` é uma prévia visual sem operações nativas.

`npm run dist` gera instalador offline e portátil em `release/`, publica hashes e copia ambos para a raiz como `Instalar Java Injeto.exe` e `Java Injeto.exe`. Não inclua JARs de autores na distribuição. Feche a versão que será sobrescrita antes de recompilar; uma pasta de saída alternativa evita mexer em um executável aberto.

Leia [Arquitetura](docs/ARQUITETURA_PTBR.md), [Continuidade](docs/CONTINUIDADE_PTBR.md), [Testes](docs/TESTES_PTBR.md) e [Privacidade](docs/PRIVACIDADE_PTBR.md) para manter o projeto. Código MIT; arquivos do jogo e mods não recebem esta licença.
