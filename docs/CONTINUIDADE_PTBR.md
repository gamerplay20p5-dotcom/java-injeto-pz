# Continuidade do Projeto

## Estado Atual: 0.2.0

Redesign da árvore existente, não recriação. O Java Injeto agora é exclusivamente um utilitário/injetor: **nunca adicionar novamente um botão ou IPC para abrir o jogo**. Os mods continuam na Workshop; só agentes conhecidos são preparados.

Referência B42.21, Windows x64. Projeto original em `%USERPROFILE%\Desktop\Launcher - Organic`; um clone pode estar em qualquer pasta. Logo Duck fornecida pelo autor; sem dependência de caminho pessoal para compilar.

## Implementado

- Sete abas compactas, temas, pastas configuráveis, revisão e detalhes de integridade.
- Serviços originais de descoberta/cópia/hashes/OpenID preservados.
- Ativação com backup integral do JSON; proteção de mudanças externas e reversão exata.
- Otimizador nativo C#: hardware, heap recomendado, prioridade, energia clonada, RAM e fechamento seletivo normal.
- Helper destacado e persistente por hash, sem CMD; fechamento da janela encerra Electron.
- Ícone Duck em PNG/ICO, recursos do executável e criação de atalho pelo app.
- 49 regressões, testes C# de energia sem tocar Windows, Electron com instalação fictícia e validação de pacote.

## Regras de Manutenção

1. Não abrir o PZ, instalar classes soltas ou substituir o JAR do jogo. O JSON é o único arquivo vanilla gerenciado, mediante revisão e backup.
2. Não redistribuir arquivos dos mods. Viewpoint permanece na Workshop e depende de ZombieBuddy.
3. Preservar `policy=prompt` e ordem Skinwalker antes de ZombieBuddy. Não confundir ordem dos cliques com ordem de agentes.
4. Não executar um JAR para revisá-lo. Hash e manifesto não são provas de segurança; assinatura ainda não é validada criptograficamente.
5. Não limpar RAM global, pagefile, caches, antivírus ou serviços Windows. Processos só são fechados por escolha explícita, sem kill.
6. Energia somente em plano clonado, com registro/restauração. Preservar mudanças manuais do usuário durante sessão.
7. Testes de escrita devem usar instalação fictícia, nunca saves ou JSON reais. Não automatizar login real ou partida de produção.
8. Sem SteamID em disco, telemetria, contas próprias ou gravação de áudio pelo utilitário.

## Retomar o Trabalho

```powershell
npm ci
npm test
npm start
npm run test:ui
npm run dist
npm run test:package
node tools/verify-portable.cjs
```

Leia `ARQUITETURA_PTBR.md`, `OTIMIZADOR_PTBR.md`, `TESTES_PTBR.md` e o código dos validadores antes de mudar contratos. Testes UI/pacote usam `tools/test-fixture.cjs`; JARs falsos são somente fixtures, jamais executados. `test:agents` é opcional e usa agentes reais num probe `-version`.

O teste do portátil usa CDP local temporário: o wrapper de extração não oferece o pipe de inspector Node esperado por `_electron.launch`. O modo normal do aplicativo não abre porta de depuração. Ao atualizar a distribuição, substitua também a cópia estável `Java Injeto.exe` da raiz, após fechar a anterior.

## Próximos Passos

Primeiro homologar manualmente injeção e restauração com a Steam, cada agente isolado e os três componentes juntos, em saves descartáveis. Confirmar comportamento em MP/anticheat. Medir frametime, FPS, RAM e temperatura antes/depois dos perfis, sem prometer ganho universal.

Testar o monitor em partida real, retirada da tomada, fechamento abrupto do app, permissões negadas e recuperação de energia. Cenários de energia automatizados usam executor simulado e não provam permissões reais em todos os PCs.

Depois avaliar assinatura Windows, validação criptográfica JAR, limpeza explícita de helpers/cópias antigas sem apagar referências ativas e cadastro de novos agentes homologados. Atualização remota assinada não existe.

Repositório: https://github.com/gamerplay20p5-dotcom/java-injeto-pz. Código MIT. A publicação 0.1.0 tinha outro fluxo; não afirmar que um binário 0.2.0 foi publicado antes de realmente disponibilizá-lo. Não versionar release, JARs, dados locais ou segredos.
