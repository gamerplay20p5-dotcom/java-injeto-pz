# Segurança

## Reportar em Privado

Use [Report a vulnerability](https://github.com/gamerplay20p5-dotcom/java-injeto-pz/security/advisories/new) na aba Security deste repositório. Não publique exploração funcional, credenciais, dados de jogadores ou logs pessoais em uma issue pública.

Inclua versão ou commit afetado, descrição, impacto esperado e passos mínimos de reprodução em ambiente de teste. Use dados fictícios; não envie JARs de terceiros, saves de produção, gravações VOIP ou SteamIDs de outras pessoas. Não temos SLA ou garantia de recompensa financeira.

## Escopo

São relevantes falhas em caminhos, descompressão de JARs, validação de perfil, execução Java, exclusão de arquivos, ponte IPC, isolamento Electron e autenticação OpenID.

O código de um agente Java tem acesso às permissões do usuário. SHA-256 verifica o conteúdo, não sua segurança ou autoria. Um problema interno de Skinwalker, Viewpoint ou ZombieBuddy deve também ser reportado ao respectivo autor; não inclua os arquivos desses mods neste projeto.

## Versões e Distribuição

O foco de manutenção é o código atual da branch `main` e a versão inicial `0.1.0`. Esta é uma distribuição de testes, ainda sem certificado de assinatura Windows, sem atualizador automático e sem garantia de compatibilidade universal com mods ou anticheat.

Baixe arquivos somente das [releases oficiais deste repositório](https://github.com/gamerplay20p5-dotcom/java-injeto-pz/releases) e confira `SHA256SUMS.txt`. Não desative antivírus ou SmartScreen para contornar um bloqueio. Código aberto e hashes não eliminam o risco de código de terceiros.

## Dados Locais

O launcher salva preferências, caminhos e hashes localmente. SteamID e histórico de atividades ficam em RAM. A exportação de diagnóstico é voluntária e pode revelar diretórios pessoais. Consulte [PRIVACIDADE_PTBR](docs/PRIVACIDADE_PTBR.md) antes de compartilhar qualquer arquivo.
