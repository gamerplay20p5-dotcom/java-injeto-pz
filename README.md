# Java Injeto - PZ

Utilitário desktop da Organic / DuckStudio para **revisar JARs, configurar agentes Java com backup e restaurar a instalação do cliente PZ**. Interface compacta em português brasileiro, identidade Duck em grafite e âmbar, Windows x64 e referência B42.21.

**Não abre o Project Zomboid. Não é um launcher de jogo.** Os mods completos continuam sendo baixados pela Workshop. O Otimizador configura ajustes e pode aguardar o jogo em segundo plano; quem abre o jogo é o usuário, pela Steam.

[Manual PTBR](README_PTBR.md) | [Otimizador](docs/OTIMIZADOR_PTBR.md) | [Código no GitHub](https://github.com/gamerplay20p5-dotcom/java-injeto-pz) | [Licença MIT](LICENSE)

![Interface compacta do Java Injeto com dados de teste](docs/images/launcher.png)

## Baixar e Instalar

Na [página de downloads](https://github.com/gamerplay20p5-dotcom/java-injeto-pz/releases/latest), escolha **`Java-Injeto-PZ-0.2.1-Setup.exe`** para instalar ou **`Java-Injeto-PZ-0.2.1-Windows.exe`** para usar sem instalação.

O instalador inclui o aplicativo completo, sem baixar outros arquivos. O assistente é em PTBR, instala para sua conta, permite escolher a pasta e cria atalhos com o ícone Duck. Não precisa de Node.js nem de Java global. Não instala mods, não altera o PZ e não abre o jogo ou o aplicativo automaticamente.

Para desinstalar, use **Configurações do Windows > Aplicativos > Java Injeto - PZ**. **Desinstalar não desfaz a injeção:** primeiro use **Backup > Restaurar backup** e, se necessário, **Otimizador > Restaurar sessão**. Configurações, agentes e backups em AppData são preservados para não quebrar referências do jogo. [Instalação, atualização e remoção](docs/INSTALACAO_PTBR.md).

## Fluxo de Uso

1. Instale os mods pela Workshop e feche o PZ.
2. Abra o atalho **Java Injeto** instalado, ou `Java Injeto.exe` na versão portátil.
3. Use **Verificar pastas**. Em **Configurações**, selecione manualmente o jogo, a Steam ou pastas adicionais de mods quando necessário.
4. Selecione componentes, use **Revisar JAR**, confira origem, SHA-256 e manifesto, e autorize a preparação.
5. Clique em **Injetar agora**. Confira destinos e backup antes de confirmar.
6. Feche o utilitário e abra o PZ normalmente pela Steam. A injeção permanece configurada sem manter a interface aberta.
7. Para reverter, feche o jogo e use **Backup > Restaurar backup**.

A revisão não executa o JAR. Um hash detecta alterações, mas **não certifica segurança**. Agentes têm as permissões do usuário Windows. A presença de arquivos de assinatura é exibida sem alegar verificação criptográfica.

## O Que É Alterado

- Agentes aprovados recebem cópias isoladas em `%APPDATA%\Java Injeto - PZ\runtime\<SHA-256>\`.
- A ativação usa `-javaagent` no **`ProjectZomboid64.json`**, após backup integral do original e confirmação.
- `projectzomboid.jar`, Java bundled, DLLs, saves e arquivos dos mods não são substituídos.
- Não existe injeção em processo aberto nem instalação de `.class` avulsas. Processos do jogo detectados bloqueiam escrita e restauração.
- Alterações externas no JSON e backups adulterados bloqueiam restauração automática, em vez de sobrescrever mudanças.

`media/java` é a origem de alguns mods, **não um destino universal de instalação**. Os destinos reais são mostrados na revisão.

| Componente | Tratamento | Dependência |
| --- | --- | --- |
| Skinwalker | Cópia de `SkinwalkerAgent.jar`, ativada como agente | Nenhuma |
| [Viewpoint](https://steamcommunity.com/sharedfiles/filedetails/?id=3809306528) | JAR permanece na Workshop; carregamento pelo framework | ZombieBuddy |
| [ZombieBuddy](https://steamcommunity.com/sharedfiles/filedetails/?id=3619862853) | Cópia de `ZombieBuddy.jar`, com `policy=prompt` | Nenhuma |

Viewpoint não é um agente independente. Skinwalker entra antes de ZombieBuddy, independentemente da ordem dos cliques. Arquivos de mods não acompanham o código ou o executável.

## Otimizador

Detecção nativa de CPU, GPU, RAM e discos; perfis Equilibrado, Desempenho e Econômico; recomendação automática de memória Java; preservação do coletor vanilla; prioridade opcional, plano de energia temporário, monitoramento de RAM e fechamento seletivo de aplicativos com confirmação.

O auxiliar é escrito em **C#**, sem janela de CMD. Ao fechar a interface, Electron encerra. Somente o auxiliar nativo continua, se uma sessão tiver sido explicitamente ativada. Ele aguarda o PZ, aplica opções selecionadas e restaura ao encerrar. Não purga memória do jogo nem força o encerramento de outros aplicativos.

Ganhos dependem do hardware e da carga. Não é um patch do motor Java nem uma garantia de mais FPS. [Configurações, limites e recuperação](docs/OTIMIZADOR_PTBR.md).

## Compilar

Windows 10/11 x64, Node.js 24, npm e compilador C# do .NET Framework. O executável final não exige Node.js no computador do usuário.

```powershell
npm ci
npm test
npm start
npm run dist
npm run test:package
```

`npm start` compila o auxiliar e a interface. `npm run dist` gera o instalador e o portátil em `release/`, com hashes em `SHA256SUMS.txt`, e mantém cópias fáceis de achar na raiz: **`Instalar Java Injeto.exe`** e **`Java Injeto.exe`**. O botão **Localizar executável** abre sua pasta, e **Criar atalho** usa o ícone Duck incorporado no arquivo.

A versão `0.2.1` acrescenta instalação ao utilitário 0.2. A antiga `0.1.0` publicada era um launcher e tem outro funcionamento. Consulte as [releases](https://github.com/gamerplay20p5-dotcom/java-injeto-pz/releases) para conferir os arquivos publicados. O executável não tem certificado de assinatura: não desative antivírus; confira procedência e `SHA256SUMS.txt`.

## Testes e Documentação

| Comando | Cobertura |
| --- | --- |
| `npm test` | Regressões de injeção/restauração, instalador e auxiliar C#; energia testada com executor simulado |
| `npm run test:ui` | Electron real, sete abas, preparação/injeção/backup em instalação fictícia, hardware, temas e dimensões compactas |
| `npm run test:package` | Pacote Windows, recursos Duck, auxiliar C#, IPC, isolamento e hash do portátil |
| `node tools/verify-portable.cjs` | Abertura/encerramento do portátil real com perfil fictício e detecção C# |
| `npm run test:installer` | Instalação, atualização, app instalado e desinstalação NSIS com identidade isolada; dados preservados |
| `npm run test:agents` | Agentes reais e Java do PZ em probe `-version`; não abre uma partida |

Testes automatizados não homologam uma partida SP/MP, VOIP, anticheat ou ganhos de FPS.

- [Arquitetura e explicação do código](docs/ARQUITETURA_PTBR.md)
- [Continuidade e próximos passos](docs/CONTINUIDADE_PTBR.md)
- [Cadastro de futuros agentes](docs/NOVOS_AGENTES_PTBR.md)
- [Privacidade](docs/PRIVACIDADE_PTBR.md), [Segurança](SECURITY.md) e [Como contribuir](CONTRIBUTING.md)
- [Resultados e roteiro manual](docs/TESTES_PTBR.md)
- [Bibliotecas e créditos](docs/TERCEIROS_PTBR.md)

## Privacidade e Créditos

Sem telemetria, backend, upload automático, gravação de voz pelo utilitário ou armazenamento de credenciais. Login Steam opcional no navegador oficial; SteamID somente na memória da sessão. Caminhos e hashes são locais. Diagnósticos exportados manualmente podem conter diretórios pessoais.

Código próprio sob MIT. Mods de terceiros mantêm suas licenças. Project Zomboid: The Indie Stone; Steam: Valve; ZombieBuddy: zed-0xff e colaboradores; Viewpoint: autores da publicação original. Projeto independente, sem afiliação oficial.
