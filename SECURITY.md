# Segurança

## Reportar em Privado

Use [Report a vulnerability](https://github.com/gamerplay20p5-dotcom/java-injeto-pz/security/advisories/new) na aba Security deste repositório. Não publique exploração funcional, credenciais, dados de jogadores ou logs pessoais em uma issue pública.

Inclua versão ou commit afetado, descrição, impacto esperado e passos mínimos de reprodução em ambiente de teste. Use dados fictícios; não envie JARs de terceiros, saves de produção, gravações VOIP ou SteamIDs de outras pessoas. Não temos SLA ou garantia de recompensa financeira.

## Escopo

São relevantes falhas em caminhos, descompressão de JARs, validação de perfil, backup/restauração JSON, detecção de processo, sessão C#, energia, exclusão de arquivos, ponte IPC, isolamento Electron e autenticação OpenID. O aplicativo não abre o jogo.

O código de um agente Java tem acesso às permissões do usuário. SHA-256 verifica o conteúdo, não sua segurança ou autoria. Um problema interno de Skinwalker, Viewpoint ou ZombieBuddy deve também ser reportado ao respectivo autor; não inclua os arquivos desses mods neste projeto.

## Versões e Distribuição

O foco de manutenção é o código atual e a versão `0.2.0` do utilitário. A versão inicial publicada `0.1.0` era um launcher, com fluxo diferente. Esta é uma distribuição de testes, sem certificado Windows, atualizador automático ou garantia de compatibilidade universal com mods/anticheat. Confira a versão realmente publicada antes de baixar.

Baixe arquivos somente das [releases oficiais deste repositório](https://github.com/gamerplay20p5-dotcom/java-injeto-pz/releases) e confira `SHA256SUMS.txt`. Não desative antivírus ou SmartScreen para contornar um bloqueio. Código aberto e hashes não eliminam o risco de código de terceiros.

## Dados Locais

O launcher salva preferências, caminhos e hashes localmente. SteamID e histórico de atividades ficam em RAM. A exportação de diagnóstico é voluntária e pode revelar diretórios pessoais. Consulte [PRIVACIDADE_PTBR](docs/PRIVACIDADE_PTBR.md) antes de compartilhar qualquer arquivo.
