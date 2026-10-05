# Arquitetura e Código

## Estrutura Preservada

O projeto existente Electron/React foi mantido. Descoberta, parsing VDF, validação de catálogo, revisão de manifesto, SHA-256, dependências, cópias e OpenID continuam nos serviços originais. A versão 0.2 substitui a interface e remove todos os comandos IPC que abriam o jogo.

Electron hospeda a janela e diálogos. C# executa hardware, detecção de processos, prioridade e energia. O aplicativo não é JavaScript apenas, não injeta em processo aberto e não precisa manter Chromium no segundo plano da partida.

| Módulo | Responsabilidade |
| --- | --- |
| `src/main/catalog.cjs`, `catalog.json` | Componentes conhecidos e validação de campos/dependências |
| `src/main/discovery.cjs` | Registro Steam, VDF, pastas manuais e busca estrutural |
| `src/main/jar.cjs` | ZIP/manifesto, premain, versão, indicação de assinatura e hash |
| `src/main/files.cjs` | Leituras limitadas, hash por stream, escrita atômica e contenção de caminhos |
| `src/main/profile.cjs` | Preferências e preparação das cópias aprovadas |
| `src/main/injection.cjs` | Revisão, backup integral, atualização JSON e restauração |
| `src/main/optimizer.cjs` | Perfis, calibração, IPC nativo e ciclo do auxiliar |
| `native/OrganicHelper.cs` | Consultas Windows, monitor e restauração temporária |
| `native/PowerSession.cs` | Plano clonado/restauração, com executor testável |
| `src/main/steam-auth.cjs` | OpenID no navegador com confirmação Steam |
| `src/main/index.cjs` | Janela, protocolo, IPC autorizado e operações serializadas |
| `src/preload.cjs` | Ponte restrita; não oferece shell, Node ou abertura de jogo |
| `src/renderer/App.jsx`, `styles.css` | Sete abas, estados, confirmações e interface responsiva |
| `tools/build-native.ps1` | Compilação C# local; não usa servidor ou download de helper |
| `tools/prepare-brand.ps1` | Conversão da logo fornecida e ICO multirresolução |

## Descoberta e Revisão

Consulta apenas SteamPath e `libraryfolders.vdf`; não lê contas, cookies ou credenciais. A busca visita diretórios estruturais até profundidade seis, orçamento 1.800 por raiz, até oito pastas adicionais. Pula `media`, mapas, modelos e ferramentas. Não há varredura permanente.

JAR: arquivo regular de 22 bytes a 128 MiB; manifesto principal até 4 MiB, necessário para o manifesto assinado grande do ZombieBuddy. SHA-256 usa stream. Ler o ZIP ainda consome memória temporária limitada pelo tamanho máximo; não é um antivírus.

Tokens de revisão expiram em cinco minutos. Hashes e seleção são revalidados antes de preparar. Cópias vão para runtime próprio por hash. Viewpoint permanece na Workshop; Skinwalker antes de ZombieBuddy; `policy=prompt` preservado. Versão ausente no manifesto é mostrada como não declarada.

## Injeção Reversível

`Profiles.launchPlan()` e `commandFor()` foram mantidos como validadores internos de argumentos e cópias. **Não existe handler de launch, nem execução desse plano pelo aplicativo.** O teste de agentes reutiliza estes validadores em probe isolado, não numa partida.

`Injection.review()` valida pasta, contenção do JSON, agentes desconhecidos e configuração atual. A aplicação revalida o token, destino e hash; grava um backup integral e um journal antes da escrita atômica do JSON. Reaplicar usa o original preservado, não um JSON já modificado como novo baseline.

Classpath, classe principal, flags nativas e coletor Windows são preservados. Heap/SoftMax são gerenciados conforme opções, e apenas agentes conhecidos são adicionados. Agentes não gerenciados em qualquer variante Windows impedem combinação automática. Classes avulsas antigas bloqueiam sem serem apagadas.

`restore()` exige hash do backup e JSON atual reconhecido. `previousHash` permite recuperar uma gravação interrompida. Mudanças externas bloqueiam restauração para não perder configuração manual. Remoção do runtime é recusada enquanto houver referências ativas ou estado desconhecido.

O jogo usa os agentes quando iniciado pelo próprio launcher vanilla/Steam que lê `ProjectZomboid64.json`. O utilitário não modifica opções Steam, não substitui `projectzomboid.jar` e não captura saída do jogo.

## Auxiliar C#

Consultas WMI sob demanda, RAM pela API Windows, execução sem shell e sem CMD. O monitor aceita somente nomes/processos da sessão Windows atual, executável dentro do jogo selecionado e, para Java, a classe cliente PZ. Servidor dedicado não é alvo. Nenhuma chamada abre o jogo.

Ativação copia o helper próprio por SHA-256 para AppData antes de destacá-lo: o portátil pode apagar sua extração temporária ao fechar, sem apagar o helper em execução. Mutex impede duplicação. Estado tem tamanho limitado; amostragem é de dez segundos, sem log infinito. Objetos de processos encerrados são descartados.

Prioridade nunca usa tempo real. Energia clona o plano ativo e modifica apenas a cópia; journal permite recuperar interrupção. Restauração respeita plano escolhido manualmente durante a sessão. Não modifica plano original, antivírus, drivers, caches globais ou working sets.

Ao fechar a janela, Electron encerra. Se explicitamente ativado, o helper continua esperando até 30 minutos; após o jogo encerrar, finaliza e restaura. O usuário pode solicitar parar/reverter pela interface reaberta.

## Isolamento e Privacidade

`contextIsolation`, sandbox, `nodeIntegration:false`, CSP local e validação de frame/origem em cada IPC. Sem janela remota, iframes, microfone/câmera ou comandos arbitrários. Clipboard aceita somente texto limitado; abertura de pastas usa destinos conhecidos.

OpenID usa navegador oficial, callback em `127.0.0.1`, estado aleatório, prazo cinco minutos e endpoint Steam fixo sem redirects. Campos assinados, nonce e identidade são validados. SteamID somente em RAM; atividade até 60 eventos. Exportação é explícita.

Operações de escrita são serializadas. Detecção de jogo aberto antecede injeção/restauração. Agentes terceiros não estão dentro do sandbox Electron: mantenha aviso de risco e nunca alegue que manifesto/hash provam segurança.
