# Otimizador

## Objetivo

Integrar as funções úteis do FPS Booster existente ao Java Injeto: detecção, calibração, prioridade e energia temporária. Não copiar a estratégia de purgas globais, limpezas periódicas de working set ou encerramentos forçados: podem introduzir paginação, travadas ou perda de documentos.

Não é um patch das classes Java do motor, não promete FPS e **não abre o jogo**. Configuração JVM é aplicada antes da partida com backup; uma sessão nativa pode aguardar a abertura manual pela Steam.

## Hardware e Memória

CPU, GPU e discos vêm de consultas WMI sob demanda; RAM usa a API Windows. Algumas máquinas não informam tipo de disco/GPU corretamente: a interface exibe o detectado, não inventa valores. RAM utilizável pode aparecer como 15,7 GB numa máquina comercialmente vendida com 16 GB.

| Perfil | Fração da RAM utilizável | Teto automático | Prioridade opcional | Energia na cópia temporária |
| --- | --- | --- | --- | --- |
| Equilibrado | 37,5% | 8 GB | Normal | CPU mínimo 5%, máximo 100% |
| Desempenho | 50% | 12 GB | Acima do normal | CPU mínimo 20%, máximo 100% |
| Econômico | 25% | 4 GB | Normal | CPU mínimo 5%, máximo 85% |

Há reserva mínima de 4 GB fora do heap. O resultado é arredondado para baixo em passos de 0,25 GB; máquinas com menos de 6 GB mantêm o padrão. Com 16 GB utilizáveis: 6/8/4 GB. Não significa que toda memória fora do heap esteja livre: Windows, outros apps e memória nativa do PZ também consomem RAM.

O limite é uma heurística inicial, não benchmark. Modpacks grandes podem precisar de ajuste manual. Se houver paginação, reduza aplicativos e compare frametime/RAM; aumentar heap sem espaço físico não resolve.

## JVM

`Aplicar configuração JVM` passa pela mesma revisão/backup da injeção. Preserva classe principal, classpath, coletor e flags nativas. Memória automática ou manual controla `-Xmx`; não força `-Xms` igual ao máximo.

Quando ZGC já está ativo e há heap configurado, a opção de parâmetros usa `SoftMaxHeapSize`: 75% do máximo em Equilibrado/Econômico, 100% em Desempenho. É uma meta flexível, não um bloqueio rígido; ZGC ainda pode crescer até `Xmx`. [Documentação Oracle JDK 25](https://docs.oracle.com/en/java/javase/25/gctuning/hotspot-virtual-machine-garbage-collection-tuning-guide.pdf).

As flags foram aceitas em um probe `java -version` com a JVM 25.0.1 bundled desta máquina. Isso não prova ganho numa partida. Não usa flags legadas removidas, `AlwaysPreTouch`, coletor trocado à força ou pacotes genéricos de parâmetros.

## Sessão Sem CMD

1. Selecione prioridade, energia e/ou monitoramento.
2. Clique em **Ativar em segundo plano**.
3. Abra o PZ manualmente pela Steam. A interface pode ser fechada.
4. O auxiliar C# aguarda no máximo 30 minutos; detecta somente o cliente da instalação escolhida.
5. Após o PZ sair, encerra a sessão e restaura mudanças temporárias. A detecção amostra a cada dez segundos; o encerramento pode levar cerca de 30 segundos.

Electron sai ao fechar a janela. O helper é próprio e copiado para AppData por hash, não depende da extração temporária do portátil. Usa estado sobrescrito, mutex e descarte dos objetos de processos encerrados; não acumula amostras ou histórico infinito. O consumo nativo não é zero e deve ser medido em cada PC.

## Energia e Recuperação

Somente na tomada. O plano atual é duplicado; ajustes pertencem à cópia, nunca ao original. A volta à bateria reverte energia. Se o usuário escolher outro plano manualmente, a recuperação preserva essa escolha e remove somente a cópia reconhecida do utilitário. [Comandos powercfg da Microsoft](https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/powercfg-command-line-options).

Se o helper ou Windows sofrer interrupção abrupta, `finally` não é garantido. O registro permanece em `optimizer/power.json`; reabra o app e use **Restaurar sessão**. Se houver registro adulterado, plano não reconhecido ou permissão negada, a ferramenta informa erro e preserva evidências; não apaga planos desconhecidos.

Prioridade nunca é tempo real e não reduz prioridade de processos que já estejam acima do normal. Restaura a original quando aplicável e sem sobrescrever uma mudança manual durante a sessão. Não modifica serviços, BIOS, overclock, drivers, antivírus ou Registro.

## Aplicativos em Segundo Plano

Lista permitida: Spotify, Teams e navegadores Chrome/Edge/Firefox/Brave/Opera, somente na sessão atual e com janela. O usuário seleciona e confirma cada aplicativo. `CloseMainWindow` solicita fechamento normal; o app pode negar ou perguntar por documentos. Não existe kill ou encerramento automático de lista inteira.

## Restaurar Padrão

**Restaurar sessão** para o helper e recupera ajustes temporários. **Restaurar padrão** redefine preferências e, após aviso, devolve o JSON original, removendo também a ativação dos agentes. Depois é possível revisar/injetar novamente. Mudança externa no JSON bloqueia restauração automática.

Para comparar desempenho, teste os perfis em save descartável com a mesma área/modpack e registre FPS, frametime, RAM e temperatura. Não atribua melhorias ao programa sem comparação controlada.
