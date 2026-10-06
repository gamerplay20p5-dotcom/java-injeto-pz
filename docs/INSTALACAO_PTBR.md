# Instalacao do Java Injeto

## Download

Use somente a [pagina oficial de releases](https://github.com/gamerplay20p5-dotcom/java-injeto-pz/releases/latest). O arquivo `Java-Injeto-PZ-0.3.0-Setup.exe` instala o aplicativo. `Java-Injeto-PZ-0.3.0-Windows.exe` e a alternativa portatil, sem instalacao.

O Setup e completo/offline: nao pede login, nao baixa mods ou Java global e nao precisa de Node.js no computador do jogador. O runtime do aplicativo ja esta incluido. Mods como Skinwalker, Viewpoint e ZombieBuddy continuam pela Workshop.

## Instalar

1. Feche uma instancia anterior do Java Injeto.
2. Execute o Setup e leia a tela inicial em PTBR.
3. Mantenha a pasta sugerida ou escolha uma pasta exclusiva do aplicativo. **Nao use a pasta do PZ, da Workshop ou de um save.**
4. Conclua a instalacao. O aplicativo nao sera iniciado automaticamente.
5. Abra **Java Injeto** pela area de trabalho ou menu Iniciar. Revise pastas e JARs antes de confirmar qualquer injecao.

A instalacao usa sua conta Windows, normalmente em `%LOCALAPPDATA%\Programs\Java Injeto - PZ`. O assistente mostra o destino exato e permite alteracao. Nao solicita elevacao nem permite instalar para todos os usuarios.

O instalador e o aplicativo usam o icone Duck. A pasta de instalacao contem o programa e seu desinstalador; os dados ficam separados em `%APPDATA%\Java Injeto - PZ`. Nenhum arquivo do jogo e alterado pelo Setup.

O executavel ainda nao possui certificado Windows. SmartScreen pode exibir um aviso. Confira a origem e o SHA-256 antes de executar; nao desative o antivirus para instalar.

```powershell
Get-FileHash -Algorithm SHA256 .\Java-Injeto-PZ-0.3.0-Setup.exe
```

Compare com `SHA256SUMS.txt` da mesma release. Hash confirma integridade, nao prova que um programa e seguro.

## Atualizar

Desde a 0.3.0, use **Configuracoes > Atualizacoes**: verifique, confirme o download e depois confirme instalar. O app fecha; o auxiliar C# abre o assistente, sem CMD. Reabra o atalho apos concluir. A verificacao ao abrir e opcional e comeca desligada. Nao ha download/instalacao silenciosos. [Detalhes](ATUALIZACOES_PTBR.md).

Tambem pode fechar a interface e executar o novo Setup manualmente. O instalador reconhece a instalacao anterior e substitui os arquivos do aplicativo. Preferencias, backups e runtime Java permanecem em AppData. A primeira migracao da 0.2.1 para 0.3.0 exige o novo Setup, porque o aplicativo antigo nao tinha atualizador.

Uma copia portatil pode usar os mesmos dados da versao instalada. Nao abra as duas ao mesmo tempo. Atualizar o utilitario nao atualiza os mods; apos uma atualizacao de JAR, revise e prepare novamente no aplicativo.

O botao de atualizar da edicao portatil instala a edicao mantida e seu atalho, sem substituir o portatil antigo. Para continuar portatil, use o novo arquivo Windows.exe da release.

## Desinstalar Sem Quebrar o Jogo

1. Feche o PZ.
2. Abra Java Injeto e use **Backup > Restaurar backup** se deseja desfazer a injecao.
3. Se ativou o Otimizador, use **Restaurar sessao**.
4. Se tambem deseja remover copias Java, use o comando proprio do aplicativo depois da restauracao. Ele verifica referencias antes de remover.
5. Abra **Configuracoes do Windows > Aplicativos > Java Injeto - PZ > Desinstalar**.

Desinstalar remove o programa e seus atalhos, **mas nao desfaz a injecao nem apaga AppData**. O jogo pode continuar apontando para agentes nessa pasta. Backups, preferencias e arquivos preparados sao mantidos de proposito; nao sao vazamento de memoria e nao mantem a interface executando.

A exclusao automatica de AppData pelo argumento `--delete-app-data` e bloqueada. Nunca apague o runtime ou os backups para contornar uma falha de restauracao. Reinstale o aplicativo para recuperar acesso aos mesmos dados quando necessario.

## Compilacao e Testes

`npm run dist` compila o auxiliar C#, a interface e os dois executaveis Windows x64. Mantem os artefatos em `release/`, gera SHA-256 e copia para a raiz:

- `Instalar Java Injeto.exe`: instalador.
- `Java Injeto.exe`: portatil.

`build/installer.nsh` usa o assistente NSIS do electron-builder; a configuracao esta em `package.json`. O appId e o nome permanecem estaveis para preservar dados e reconhecer atualizacoes. Sem integracoes ou alteracoes novas na logica de injecao.

`npm run test:installer` empacota uma identidade NSIS descartavel, instala em pasta temporaria, abre o programa com perfil ficticio, reinstala, verifica o bloqueio da exclusao de dados e desinstala. Confere sentinelas de preferencias/backup/runtime e hashes dos dados e atalho de producao. O teste nao abre o PZ e nao testa uma instalacao silenciosa sobre o aplicativo do usuario.
