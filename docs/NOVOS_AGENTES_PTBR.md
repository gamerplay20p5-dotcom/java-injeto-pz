# Cadastrar Futuros Agentes Java

Esta versão usa um catálogo distribuído com o aplicativo. Não baixa nem executa automaticamente catálogos remotos. Cada alteração exige compilar e distribuir uma nova versão do launcher.

## Antes de Adicionar

1. Consulte o autor e a licença. Não redistribua os arquivos Java de terceiros sem autorização.
2. Verifique o procedimento oficial de instalação, a build alvo e o manifesto `META-INF/MANIFEST.MF`.
3. Um JAR com `Premain-Class` apropriada pode ser candidato a `kind: "agent"`. Um JAR comum não vira agente ao mudar seu nome.
4. Se depender de um framework para carregamento, mantenha `kind: "workshop"` e cadastre o framework em `dependencies`. O mod completo continua na Workshop.
5. Se exigir DLL nativa de mod ou substituir classes/JAR vanilla, **não está coberto por esta versão**. A única configuração vanilla gerenciada é o JSON de inicialização, com consentimento e backup.

## Exemplo de Registro

Este exemplo é documentação, não um mod já suportado:

```json
{
  "id": "agente-exemplo",
  "name": "Agente Exemplo",
  "modId": "ExemploModID",
  "kind": "agent",
  "category": "Compatibilidade",
  "accent": "teal",
  "workshopId": "1234567890",
  "description": "Descrição curta para identificar o componente.",
  "notes": "Dependências, build e instruções específicas do autor.",
  "jarName": "ExemploAgent.jar",
  "jarPaths": ["42/media/java/ExemploAgent.jar"],
  "premain": "br.exemplo.Agent",
  "dependencies": [],
  "build": "42.21"
}
```

`workshopId` é o número da página Steam; `modId` é o ID em mod.info. Não são a mesma coisa. `jarPaths` é relativo à raiz do mod, acima de `42`/`common`, e aceita até oito candidatos. `jarName` não pode conter caminhos. IDs internos usam letras minúsculas, números e hífen.

Só são aceitas as cores `coral`, `teal` e `lime`, tipos `agent`/`workshop` e os campos declarados pelo validador. Dependências precisam existir e não podem formar ciclos. Não adicione comandos, URLs de downloads, scripts de instalação ou argumentos livres ao catálogo.

Para um framework diferente do ZombieBuddy, primeiro implemente e teste a ponte específica. Apenas listar uma dependência não ensina outro framework a carregar JARs. Em `commandFor()` e `configuredJson()`, ZombieBuddy é o único agente com argumento adicional especial; os demais recebem `-javaagent:<caminho>` sem argumentos. Nenhum desses métodos abre o jogo.

## Lista de Validação

1. Adicione a entrada em `catalog.json`, sem incluir o JAR no repositório ou distribuição.
2. Rode `npm test` e acrescente regressão para o procedimento desse agente.
3. Teste a detecção, preparação e remoção com caminhos contendo espaços e instalação em outro disco.
4. Teste premain a partir da **cópia do launcher**, não apenas no diretório original do autor.
5. Teste a partida real em save descartável, separadamente e em conjunto com os agentes já suportados.
6. Verifique que somente o JSON autorizado mudou, que o backup preserva os bytes anteriores e que a restauração é exata. JAR do jogo, Workshop e saves devem permanecer intactos.
7. Atualize créditos, documentação, notas e versão antes de `npm run dist`.

`tools/verify-agents.cjs` é específico para os dois agentes atuais; ajuste-o conscientemente quando ampliar o catálogo. Novos agentes não estão automaticamente homologados para SP, MP, Linux ou toda futura build do jogo.
