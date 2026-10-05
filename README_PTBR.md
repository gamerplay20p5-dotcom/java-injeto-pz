# Java Injeto - PZ

Launcher desktop da Organic para iniciar o **cliente Windows do Project Zomboid com agentes Java aprovados**. Interface em PTBR, temas claro/escuro, busca local de arquivos e login Steam opcional pelo navegador.

**Os mods continuam sendo baixados pela Workshop.** Este aplicativo não distribui nem instala Lua, mapas, texturas, modelos, arquivos `.class` soltos ou DLLs de mods. Não substitui o Java do jogo, não modifica o JSON vanilla e não escreve em saves.

## Começar

1. Baixe os mods e suas dependências pela Workshop normalmente. Para Skinwalker ainda não publicado, mantenha sua pasta de desenvolvimento local ou selecione seu JAR nos detalhes.
2. Abra a Steam e feche qualquer instância anterior do PZ.
3. Baixe e execute `Java-Injeto-PZ-0.1.0-Windows.exe` nos [arquivos da versão](https://github.com/gamerplay20p5-dotcom/java-injeto-pz/releases/tag/v0.1.0). Quem compila o código encontra o arquivo em `release/`. Não precisa instalar Node.js ou executar como administrador.
4. Clique em **Buscar arquivos**. Se necessário, selecione a pasta do PZ em Configurações. A pasta correta contém `ProjectZomboid64.json`, `projectzomboid.jar` e `jre64/bin/java.exe`.
5. Selecione os componentes Java. Selecionar Viewpoint inclui ZombieBuddy automaticamente; Skinwalker pode ser usado sozinho.
6. Clique em **Revisar e preparar**. Confira origem, hash e avisos antes de autorizar.
7. Clique em **Iniciar PZ**, revise a inicialização e confirme. O launcher usa o Java que já acompanha o jogo.
8. Ative os mods Lua dentro do PZ ou conecte ao servidor que já os exige. Preparar Java não ativa a lista de mods do jogo.

**Use Iniciar PZ neste launcher para carregar o perfil.** O botão Jogar da Steam e os atalhos antigos não são modificados. O aplicativo prepara JARs apenas após sua confirmação, nunca automaticamente ao abrir.

## Componentes Cadastrados

| Componente | Tratamento | Mod ID | Dependência |
| --- | --- | --- | --- |
| Skinwalker | Cópia local de `SkinwalkerAgent.jar` e `-javaagent` | `DuckSkinwalker` | Nenhuma |
| Viewpoint | Seu JAR permanece na Workshop e é carregado pelo framework | `Viewpoint` | ZombieBuddy |
| ZombieBuddy | Cópia local de `ZombieBuddy.jar` e `-javaagent`, com aprovação `policy=prompt` | `ZombieBuddy` | Nenhuma |

**Viewpoint.jar não é um agente independente.** Não pode simplesmente receber `-javaagent`. Seu mod completo precisa estar instalado/ativo normalmente para que o ZombieBuddy encontre o JAR e os arquivos de assinatura existentes na Workshop. O launcher não copia esses arquivos nem libera todos os JARs automaticamente.

A versão publicada na Workshop tem prioridade sobre cópias locais de desenvolvimento. Um JAR manual escolhido para um agente tem prioridade explícita sobre ambas; **Usar busca automática**, nos detalhes, desfaz essa escolha manual. Para Viewpoint, escolha sua **pasta de mod**, não um JAR isolado. Uma busca estrutural limitada também encontra publicações novas por Mod ID quando seu número Workshop ainda não consta no catálogo.

## Atualizar e Desativar

Quando a Workshop alterar um JAR, o perfil anterior não é aceito silenciosamente. Busque novamente e revise/prepare a versão nova. SHA-256 detecta alteração de conteúdo, mas **não certifica a segurança ou autoria** do arquivo.

Para mudar a seleção, feche o jogo, altere os componentes e prepare novamente. Para parar de usar Java deste perfil, desmarque todos os componentes e inicie com seleção vazia, ou abra pelo caminho vanilla que não tenha instalação manual antiga. Para excluir as cópias, use **Configurações > Remover JARs**. O diretório dos mods e o jogo permanecem intactos.

Cópias antigas podem continuar em `runtime` após atualizações, até a remoção do perfil. Uma falha de preparação não publica um manifesto incompleto, mas pode deixar cópias locais sem referência. A opção de remoção limpa essas cópias também.

Agentes já instalados manualmente antes deste launcher não são desinstalados por ele. A presença de `.class` soltas dentro da pasta `zombie` do jogo bloqueia a inicialização para revisão, sem excluir nenhum arquivo. Pastas vazias não bloqueiam. Agentes desconhecidos no JSON do PZ também exigem revisão.

## Steam e Privacidade

O login é **opcional** e não exige servidor hospedado, chave Steam Web API ou senha no aplicativo. A página abre no navegador padrão, no domínio oficial da Steam. O retorno OpenID informa um SteamID público, mantido somente na memória da sessão do launcher. Senhas, Steam Guard e cookies continuam com a Steam e seu navegador. [Documentação oficial de autenticação Steam](https://partner.steamgames.com/doc/features/auth).

Login não comprova propriedade do PZ, não autentica dentro do jogo e não cria uma lista privada de pessoas autorizadas no servidor. O launcher não consulta perfil, avatar, amigos ou biblioteca. Veja [Privacidade](docs/PRIVACIDADE_PTBR.md) para os dados técnicos locais e limites dessa proteção.

## Problemas Comuns

| Situação | Verificação |
| --- | --- |
| JAR não encontrado | Confirme download concluído na Steam; use pasta adicional ou Localizar JAR para os agentes. |
| JAR atualizado ou adulterado | Remova as cópias se necessário e revise a origem confiável novamente. |
| Viewpoint não funciona | Ative Viewpoint e ZombieBuddy no PZ; mantenha o mod completo na Workshop; responda à aprovação do framework. |
| Jogo fecha ao iniciar | Veja o código de saída na Atividade e o `console.txt` do PZ. JARs incompatíveis ainda podem impedir o jogo de abrir. |
| Preparado, mas jogo vanilla | Abra pelo botão Iniciar PZ deste aplicativo, não pelo atalho antigo. |
| Login não volta | Confirme domínio Steam, navegador e relógio do Windows; cancele e tente novamente. A solicitação expira em cinco minutos. |
| SmartScreen avisa | Esta distribuição ainda não tem assinatura de código. Confirme a procedência; não desative o antivírus. |

Não escolha toda a RAM física como heap. O padrão preserva o valor vanilla; a configuração opcional altera apenas os argumentos desta inicialização.

## Desenvolvimento

O código-fonte está nesta mesma pasta. Use Node.js recente compatível com Vite 8, recomendado Node 24 LTS, npm e Windows x64.

```powershell
npm ci
npm test
npm run build
npm run test:ui
npm run test:agents
npm start
```

`test:ui` usa o Electron real com dados temporários; não inicia o PZ ou login real. `test:agents` exige os dois agentes instalados nesta máquina e executa somente `premain` + `java -version`, isolando arquivos de configuração em pasta temporária.

```powershell
npm run pack
npm run dist
```

`pack` gera a pasta Windows completa em `release/win-unpacked`; `dist` gera o executável portátil. As dependências estão fixadas no `package-lock.json`. Nenhum JAR de autor é incluído na distribuição.

Após `dist`, `npm run test:package` valida a janela empacotada, o conteúdo do pacote e gera `release/SHA256SUMS.txt`; exige PZ instalado para confirmar a descoberta. Testes de integração não fazem parte do CI público porque dependem do jogo e dos mods locais.

Feche o portátil anterior antes de recompilar para o mesmo destino. Se ele precisar permanecer aberto, depois de `npm run build` use `npx electron-builder --win portable --config.directories.output=release/public` e valide com `npm run test:package -- release/public`. Os arquivos dessa compilação ficam em `release/public/`, sem sobrescrever o executável aberto.

`npm run dev` oferece apenas uma prévia visual em `http://127.0.0.1:5178`, sem acesso nativo a arquivos, login ou execução Java. O aplicativo desktop usa recursos locais, não depende desse servidor.

## Documentação

- [Arquitetura e explicação do código](docs/ARQUITETURA_PTBR.md)
- [Como cadastrar futuros agentes](docs/NOVOS_AGENTES_PTBR.md)
- [Privacidade e segurança](docs/PRIVACIDADE_PTBR.md)
- [Testes e limitações](docs/TESTES_PTBR.md)
- [Continuidade do desenvolvimento](docs/CONTINUIDADE_PTBR.md)
- [Créditos e bibliotecas](docs/TERCEIROS_PTBR.md)

Esta é uma primeira versão funcional, não uma garantia de compatibilidade universal. A preparação, interface e entrada dos agentes foram testadas; uma partida real SP/MP e o login real Steam ainda precisam de homologação antes de distribuir para toda a temporada.

## Código Aberto

O código-fonte está no [GitHub oficial](https://github.com/gamerplay20p5-dotcom/java-injeto-pz), sob [licença MIT](LICENSE). Consulte [Como contribuir](CONTRIBUTING.md) e [Segurança](SECURITY.md). A licença do launcher não altera as licenças do jogo ou dos mods de terceiros.
