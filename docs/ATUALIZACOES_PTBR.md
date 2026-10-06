# Atualizacoes do Java Injeto

## Usar

1. Na 0.2.1 ou anterior, instale uma vez o Setup 0.3.0 da release oficial.
2. Desde a 0.3.0, abra Configuracoes > Atualizacoes > Verificar atualizacao.
3. Se houver versao superior, confirme Baixar atualizacao. Veja progresso e cancele se precisar.
4. Depois do SHA-256 conferido, confirme Instalar atualizacao > Fechar e instalar.
5. Conclua o assistente PTBR e reabra o atalho. O app e o PZ nao sao iniciados automaticamente.

Restaure a sessao do Otimizador antes de atualizar. Configuracoes, backups, preferencias e runtime permanecem em `%APPDATA%\Java Injeto - PZ`. O atualizador nao modifica injeções, saves ou mods. Na edicao portatil, abre o instalador para a edicao instalada; a antiga copia portatil nao e substituida. Para continuar portatil, baixe Windows.exe na release manualmente.

## Seguranca e Privacidade

- Repositorio fixo: `gamerplay20p5-dotcom/java-injeto-pz`. Nao recebe URLs, executaveis ou comandos arbitrarios da interface.
- API publica GitHub por HTTPS, sem login/token. A verificacao automatica ao abrir comeca desligada; nunca baixa ou instala automaticamente.
- Somente release estavel, publica, mais recente e superior a atual. Nao aceita prerelease, downgrade ou nome de asset diferente do instalador esperado.
- Exige tamanho publicado e `digest=sha256:...` fornecido pelo GitHub. Ausencia de digest bloqueia instalacao. Nao aceita um hash digitado pelo usuario.
- Redirects limitados aos hosts oficiais GitHub/CDN. Sem HTTP, credenciais embutidas ou redirecionamento externo.
- Download por stream: limite 256 MiB e prazo cinco minutos. O limite conta bytes reais, nao apenas o cabecalho HTTP. Hash/tamanho divergente nunca e executado.
- Main revalida bytes antes do handoff; C# revalida tarefa, prazo, pasta, tamanho e SHA-256 depois que o app fecha. Sem CMD e sem privilegios administrativos.
- Nao ha certificado de editor ou assinatura independente de releases. Hash garante integridade perante o GitHub, nao ausencia de codigo malicioso nem protecao contra comprometimento do repositorio/conta.
- Nenhum SteamID, caminho, hardware ou log e enviado. GitHub recebe IP e dados normais da conexao.

Downloads e o auxiliar ficam em `updates/`, por hash. Falhas nao apagam backups nem a instalacao anterior. Arquivos baixados permanecem locais; nao existe limpeza automatica de pastas de jogo ou dados. Sem internet, a injecao local continua disponivel. Para uma falha de instalacao, execute novamente o Setup oficial; nao remova runtime ou backups.

## Publicar Nova Versao

1. Alterar `package.json`/lock, interface, notas e documentacao. Manter appId/productName para preservar dados.
2. Compilar C#, rodar testes de servicos/UI/agentes/pacote/instalador. Nunca testar escrita na instalacao real do PZ.
3. `npm run dist` gera Setup.exe, Windows.exe e SHA256SUMS.txt.
4. Publicar tag `vMAJOR.MINOR.PATCH` e release estavel no repositorio fixo. Anexar nomes exatos `Java-Injeto-PZ-VERSAO-Setup.exe`, `Java-Injeto-PZ-VERSAO-Windows.exe`, `SHA256SUMS.txt`.
5. Conferir digest e tamanho dos assets pela API GitHub antes de divulgar. Sem digest, o atualizador recusara corretamente a release.
6. Atualizacoes dos mods continuam pela Steam Workshop. Corrigir Skinwalker nao redistribui seu JAR no Java Injeto.

Modulos: `src/main/updater.cjs`, IPC fechado em `index.cjs`/`preload.cjs`, interface em App.jsx e `native/UpdateHelper.cs`. Testes `updater.test.cjs` usam respostas/instaladores ficticios e validacao C# sem executar o Setup. A validacao NSIS usa identidade separada, nunca a instalacao real do usuario.
