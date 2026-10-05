# Como Contribuir

Obrigado por ajudar o Java Injeto - PZ. A interface e a documentação principal são em PTBR; código e identificadores seguem os padrões já usados no projeto.

## Preparar o Ambiente

1. Faça um fork e crie uma branch para sua alteração.
2. Use Node.js 24 e npm no Windows x64.
3. Execute `npm ci`, `npm test` e `npm run build`.
4. Use `npm start` para abrir o aplicativo desktop. A prévia `npm run dev` não oferece IPC, arquivos ou execução Java.

Testes unitários e build não precisam de PZ, agentes ou conta Steam. Os testes `test:ui`, `test:agents` e `test:package` exigem instalações locais descritas em [TESTES_PTBR](docs/TESTES_PTBR.md). Não baixe ou distribua o jogo em runners de CI.

## Regras de Segurança

- Não sobrescreva arquivos do jogo, Workshop, saves ou opções de inicialização Steam.
- Não adicione JARs, DLLs, `.class`, arquivos de jogo ou mods de terceiros ao Git.
- Não publique tokens, credenciais, arquivos `.env`, caminhos pessoais, logs completos ou gravações VOIP.
- Mantenha a revisão e a autorização explícitas antes de copiar agentes ou iniciar o jogo.
- Use argumentos separados e `shell: false`, sem montar comandos com entrada do usuário.
- Preserve hashes, limites de leitura, validação de caminhos e aprovação do ZombieBuddy; não adicione `allow-all`.
- Preserve isolamento Electron, CSP, bloqueio de conteúdo externo e verificação de origem do IPC.
- Login Steam nunca deve pedir senha no launcher ou persistir SteamID/credenciais.
- Não acrescente telemetria, upload de logs ou atualizador remoto sem discussão e análise específicas.

Consulte [Arquitetura](docs/ARQUITETURA_PTBR.md) antes de mudar preparação, exclusão, OpenID ou execução. A ordem dos agentes atuais é deliberada: Skinwalker antes de ZombieBuddy.

## Abrir um Pull Request

Descreva o problema, o comportamento esperado, a alteração feita e os comandos de teste executados. Adicione regressão para qualquer mudança em validação, permissões, dependências ou persistência. Alterações visuais devem incluir screenshots sem caminhos ou dados pessoais.

Prefira alterações pequenas e com responsabilidade clara. Não reescreva módulos inteiros para corrigir um comportamento localizado. Ao cadastrar um mod, informe a fonte oficial, requisitos de versão, dependências, `premain` quando existir e resultados reais de teste.

Mudanças aceitas no código do launcher seguem a licença MIT. Códigos ou recursos de terceiros precisam de permissão e atribuição compatíveis; o catálogo não permite incorporar esses arquivos.

## Relatar um Bug

Abra uma [issue](https://github.com/gamerplay20p5-dotcom/java-injeto-pz/issues) com versão do launcher, Windows, build do PZ, componentes selecionados e passos para reproduzir. Remova nomes de usuário, SteamIDs, diretórios pessoais, endereços de servidores e segredos de qualquer anexo.

Não abra uma issue pública para uma vulnerabilidade ainda não corrigida. Use o canal descrito em [SECURITY.md](SECURITY.md).

## Limites Atuais

A primeira versão ainda precisa de login Steam real, partidas SP/MP, testes em outros computadores e assinatura de código. A entrada de um agente em `java -version` não comprova compatibilidade durante uma partida.
