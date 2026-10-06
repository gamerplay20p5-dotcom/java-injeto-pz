# Privacidade e Limites de Segurança

## Dados do Launcher

| Dado | Onde fica | Retenção |
| --- | --- | --- |
| Caminhos PZ/Steam/mods, seleção, tema, memória e animações | `settings.json` na pasta local do aplicativo | Até o usuário remover ou alterar |
| Origem/destino, nomes e SHA-256 dos JARs preparados | `prepared.json` | Até preparar outro perfil ou remover JARs |
| Cópias dos agentes e DLL revisada | `runtime/<sha256>/` | Até remover o perfil |
| Backups nativos e registro de injeção | `backups/*.native` e `injection.json` | Preservados para restauração |
| Instalador e auxiliar de atualização | `updates/` | Cópias locais por hash; nenhuma conta ou telemetria |
| JSON original e registro de injeção | `backups/*.json` e `injection.json` | Preservados para restauração; não há limpeza automática |
| Preferências de otimização, estado e plano de energia original | `settings.json`, `optimizer/status.json`, `optimizer/power.json` | Estado é sobrescrito, sem histórico crescente; journal de energia é removido após recuperação |
| Auxiliar C# próprio | `native-runtime/<sha256>/OrganicHelper.exe` | Até limpeza explícita; permite fechar o portátil sem interromper o monitor |
| SteamID público validado | RAM do processo e da interface | Até desconectar ou encerrar |
| Estado/nonce e campos da resposta OpenID | RAM durante a solicitação | Descartados após processamento/encerramento |
| Atividade do launcher | Até 60 eventos em RAM | Sessão atual |
| Diagnóstico manual | Arquivo escolhido pelo usuário | Sob controle do usuário |

A pasta padrão é `%APPDATA%\Java Injeto - PZ`. Electron/Chromium também pode criar caches e preferências técnicas locais. Isso não é armazenamento de senha Steam ou de perfil social.

Diagnósticos exportados incluem caminhos e hashes. Um caminho pode conter o nome de usuário do Windows: revise antes de compartilhar. A exportação não inclui SteamID, senha, cookies, conversa, VOIP ou console do jogo. Não há envio automático.

## Rede e Login

O login abre `steamcommunity.com` no navegador padrão. O callback usa apenas `127.0.0.1`, não uma porta exposta na rede local. A confirmação de assinatura vai ao endpoint oficial Steam por HTTPS. O login necessita internet e revela à Steam os dados normais de uma conexão/autenticação, como IP; não existe anonimato perante a Steam.

Não operamos backend próprio, telemetria, banco de usuários, consulta de perfil, avatar, amigos ou inventário. Não recebemos senha ou Steam Guard. Cookies de login pertencem ao navegador/Steam, não a uma WebView de login do aplicativo. O histórico do navegador, a Steam e o Windows têm políticas próprias de armazenamento; o launcher não controla esses sistemas.

Atualizações consultam a API pública do GitHub e baixam releases/CDN oficiais por HTTPS, sem token, SteamID, caminhos, hardware ou logs na requisição. GitHub recebe os dados normais da conexão, como IP. A consulta automática ao abrir é opcional; download e instalação sempre exigem comando explícito.

OpenID necessariamente retorna um identificador público e parâmetros temporários de autenticação. Assim, a descrição correta é **não persistimos dados de conta e não coletamos credenciais**, não "nenhuma informação existe em qualquer momento". Não há promessa de apagar criptograficamente RAM, pagefile ou dumps do sistema operacional.

## Agentes e Mods

Agentes Java executam dentro da JVM do jogo com as permissões do usuário Windows. Eles não ficam isolados no sandbox da interface Electron. SHA-256 verifica consistência, não reputação, licença ou ausência de código malicioso.

Instale apenas arquivos de fontes confiáveis e confirme o autor. A verificação de Premain-Class evita confundir tipos de JAR, mas não comprova identidade do editor. O launcher não substitui antivírus ou revisão de código. Não execute como administrador.

O launcher não grava voz. **Skinwalker e outros mods podem ter funcionalidades de gravação próprias**, fora deste aplicativo. Consentimento, retenção, compatibilidade e transmissão desses dados continuam sendo responsabilidade dos mods. ZombieBuddy também pode salvar seus próprios arquivos de configuração/aprovação; o launcher mantém `policy=prompt` e não burla essa etapa.

## Alterações Consentidas

Somente após revisão/confirmação, `ProjectZomboid64.json` recebe agentes conhecidos e ajustes JVM selecionados, com cópia integral do original. Restauração verifica hashes e recusa alterações externas. Não representa um patch do JAR vanilla.

A única exceção nativa de mod homologada é `zbNative.dll` do ZombieBuddy, acompanhada de `ZombieBuddy.jar`: ambos vêm da instalação Workshop local e vão para a raiz do PZ com backup/reversão. Cabeçalho PE x64 e SHA-256 não verificam autoria, assinatura ou ausência de código malicioso. Não carregamos a DLL para revisá-la.

Sessão nativa opcional lê hardware, RAM e processos locais para detectar o cliente PZ. Ajusta somente prioridade dele e um plano de energia clonado. Não envia inventário de hardware/processos. Apps permitidos só recebem pedido de fechamento normal após escolha/confirmação; não são encerrados à força.

Fechar a interface encerra Electron. O helper explicitamente ativado pode continuar sem CMD, com estado local limitado. Restauro de energia após uma interrupção exige reabrir a ferramenta e usar Restaurar sessão; não prometemos execução de finally quando o Windows ou o processo é encerrado abruptamente.

## O Que Não Alteramos

- JAR vanilla e opções de inicialização Steam.
- DLLs vanilla, Java global do Windows, Registro para instalar patches e classes soltas no jogo.
- Lista de mods ativos, mapa, saves, inventário e configurações do servidor.
- Firewall, antivírus, permissões de administrador, memória de processos alheios ou plano de energia original.

Restaure o JSON antes de remover cópias ou mover a pasta de dados: a configuração usa caminhos absolutos. Remover o perfil limpa somente cópias e manifesto próprios, após verificar referências. O backup devolve o estado anterior à primeira injeção, inclusive patches manuais que já estivessem nele; não equivale necessariamente a vanilla puro. Não há garantia de que agentes combinados sejam compatíveis ou de que um mod de terceiros não possa alterar um save durante a partida.

## Distribuição

O executável inicial ainda não é assinado com certificado de editor. Distribua-o por um canal conhecido, publique seu hash e mantenha o código disponível para revisão. Não instrua usuários a desligar proteções do Windows. A integridade do programa distribuído também importa, não só a dos JARs selecionados.
