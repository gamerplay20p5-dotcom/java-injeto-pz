# Testes e Limitações

## Executados em 2026-10-05

Ambiente: Windows, instalação local PZ B42.21, Java fornecido pelo jogo e JARs presentes na máquina. Não houve partida iniciada, login real ou acesso a um servidor de produção durante a validação.

| Validação | Resultado |
| --- | --- |
| `npm test` | 38 testes automatizados aprovados |
| `npm run test:ui` | Electron real, preload/IPC, descoberta local, temas, modais, dependências, preparação e revisão de inicialização aprovados |
| `npm run test:agents` | Premain Skinwalker, ZombieBuddy e ambos juntos inicializaram sem DLL de mod extra |
| Hash do `projectzomboid.jar` e JSON vanilla | Preservados antes/depois do teste de agentes |
| Aplicativo Windows empacotado | Janela/IPC reais, isolamento ativo e pacote sem arquivos de mods |
| `npm install` / auditoria inicial | Nenhuma vulnerabilidade conhecida reportada pelo npm na execução |

As cópias dos testes são criadas em pastas temporárias próprias e removidas ao terminar. Os testes de preparação preservam os arquivos de origem e removem apenas runtime. As screenshots ficam em `test-results`, fora da distribuição.

## Cobertura

- Dependências, duplicações, ciclos e catálogo sem comandos arbitrários.
- Ordem canônica Skinwalker antes de ZombieBuddy, independentemente dos cliques; hook Exposer presente no probe combinado.
- Parser de bibliotecas Steam antigas/novas e configuração Windows por versão numérica.
- Caminhos com espaços, limites, escape de diretórios e classes soltas.
- Premain esperado, classe dentro do JAR, manifesto assinado grande e limite de descompressão.
- Preparação, revisão expirada, alteração de configuração, origem atualizada e cópia adulterada.
- Preservação de Workshop e JSON, limpeza restrita à pasta do launcher.
- Endpoint OpenID fixo, assinatura negativa, retorno/identidade divergentes, nonce antigo, duplicação de parâmetros e resposta remota excessiva.
- Retorno HTTP loopback real com confirmação Steam **simulada**, cancelamento e descarte do SteamID.
- Interface sem campos de senha, tema claro/escuro e ausência de overflow horizontal no modo compacto.

## O Que os Testes Não Provam

`premain` + `java -version` demonstra que o agente entra na JVM e encontra suas classes. **Não valida uma partida inteira**, renderização Viewpoint, captura VOIP, sincronização MP, conflitos de transformação ou carregamento de todos os mods Lua. O teste do login não entrou em uma conta real da Steam.

No probe, ZombieBuddy emite avisos sobre classes experimentais não expostas e uma API `Unsafe` depreciada usada pelo Byte Buddy. A JVM encerrou normalmente e instalou o agente; esses avisos não foram escondidos nem usados como prova de compatibilidade durante uma partida.

Ainda precisam ser homologados:

1. Login real com navegador padrão e callback aceito pela Steam, em uma conta do usuário.
2. Partida SP em save descartável, com cada componente separado e todos juntos.
3. Conexão MP à configuração exata da temporada, incluindo verificação do servidor/anticheat e aprovador ZombieBuddy.
4. Atualização real de Workshop seguida de nova aprovação e retorno ao vanilla.
5. Distribuição do portátil em outro computador Windows, instalação em outro disco, nomes acentuados e antivírus.
6. Teste prolongado de recursos/memória do launcher e do jogo, sem prometer ausência absoluta de leaks.

## Roteiro Manual

1. Faça backup do save de teste, abra Steam e feche o PZ anterior.
2. Rode o launcher com seleção vazia e teste abertura vanilla pelo botão Iniciar PZ.
3. Feche o jogo e teste somente Skinwalker, depois somente Viewpoint + ZombieBuddy.
4. Confirme as aprovações normais do framework e os mods ativos no PZ.
5. Teste todos juntos em cenário descartável; se falhar, compare cada grupo isolado antes de atribuir culpa ao launcher.
6. Atualize um JAR: o launcher deve pedir nova revisão, sem reaproveitar silenciosamente o conteúdo anterior.
7. Feche o jogo, remova runtime e confirme que Workshop/PZ/saves continuam intactos.
8. Valide login e logout: não deve surgir campo de senha nem SteamID em settings/prepared/diagnóstico.

Os testes não desligam antivirus, não editam saves de produção e não aplicam Java no servidor dedicado.
