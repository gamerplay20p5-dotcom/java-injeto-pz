# Testes e Limitações

## Validação da 0.2.0

Ambiente de desenvolvimento Windows, 2026-10-05. Nenhuma partida ou login real foi aberto para executar os testes.

| Teste | Escopo |
| --- | --- |
| `npm test` | 49 regressões aprovadas: catálogo, caminhos, cópias, OpenID, JSON e C# |
| `tests/NativeRegression.cs` | Quatro cenários de energia com executor Windows simulado |
| `npm run test:ui` | Sete abas, três componentes, preparação/injeção/restauração real em pasta fictícia, clipboard, hardware, temas e janelas compactas |
| `npm run test:package` | Executável empacotado, recursos Duck, auxiliar C#, IPC, sandbox e hash da distribuição |
| `node tools/verify-portable.cjs` | Portátil real aberto com perfil isolado, interface, hardware C# e encerramento limpo sem abrir PZ |
| `npm run test:agents` | Probe separado, exige PZ/agentes reais; não homologa uma partida |

Fixtures usam JARs sintéticos e uma configuração cliente descartável. O teste faz a escrita JSON e sua reversão **nessa instalação falsa**, verifica backup byte a byte e nunca executa os JARs falsos. Pacote usa `--user-data-dir` separado. Exclusões são restritas a diretórios temporários próprios.

O monitor C# foi compilado e testado aguardando uma pasta sem jogo executado, com energia/prioridade desativadas; duplicação foi recusada, solicitação de parar restaurou o estado e o processo encerrou sozinho. Os quatro cenários de energia cobrem clone/original, troca manual, falha parcial e registro adulterado, sem mudar os planos reais do computador.

## O Que Ainda Precisa de Partida Real

- Carregamento efetivo dos agentes pelo launcher vanilla e pela Steam depois de gravar o JSON.
- Renderização Viewpoint, VOIP Skinwalker, transformadores combinados, servidor/anticheat e compatibilidade MP.
- Login Steam com conta real e retorno no navegador usado pelo jogador.
- Ganhos de FPS/frametime, pressão de RAM, temperatura e autonomia com cada perfil.
- Energia/prioridade em computadores com políticas e permissões diferentes; recuperação após falha abrupta do helper.
- Instalação em outro disco, caminhos acentuados, SmartScreen, antivírus e teste prolongado de memória.

Probe de premain não demonstra funcionamento completo de um mod. Nenhum benchmark comparativo foi concluído nesta etapa; não declarar FPS garantido ou ausência absoluta de leaks.

## Roteiro Manual

1. Faça backup de um save descartável. Feche o PZ e confirme que ele abre vanilla pela Steam antes de testar.
2. Selecione apenas Skinwalker, revise, prepare e injete. Feche o utilitário e abra pela Steam.
3. Confira as mensagens do agente no console. Feche o jogo e restaure; compare o JSON original.
4. Repita com Viewpoint + ZombieBuddy, preservando aprovações do framework; depois teste a combinação inteira.
5. Atualize um JAR e confirme que exige nova revisão e preparação; não deve reutilizar silenciosamente o hash antigo.
6. Ative somente monitoramento de RAM, feche a interface e abra PZ manualmente. Confirme auxiliar sem CMD e encerramento após sair do jogo.
7. Teste prioridade e energia separadamente. Confira o plano original depois de encerrar e ao solicitar Restaurar sessão.
8. Troque o plano manualmente durante a sessão: restauração não deve substituir a escolha manual.
9. Edite um JSON de teste após injetar: restauração deve recusar para preservar mudanças externas.
10. Confirme que diagnóstico e preferências não persistem SteamID/credenciais, e que nenhum arquivo Workshop/save foi alterado.
